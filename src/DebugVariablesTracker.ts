import * as vscode from 'vscode';
import { DebugProtocol } from "vscode-debugprotocol";
import { Service, Container } from "typedi";
import { VariablesList } from "./watch-view/WatchVariable";
import { WatchTreeProvider } from "./watch-view/WatchTreeProvider";
import { saveTracked } from './watch-view/tracked';
import { logTrace } from "./logging";
import { getConfiguration } from "./config";

type TrackedVariable = {
    name: string;
    evaluateName: string;
    frameId: number;
    type: string;
};

@Service()
export class DebugVariablesTracker {
    readonly localVariables: TrackedVariable[] = [];
    readonly globalVariables: TrackedVariable[] = [];

    readonly scopesRequests: Map<number, {
        frameId: number;
    }> = new Map();
    readonly frameForVariableReference = new Map<number, {
        frameId: number;
        scope: 'local' | 'global';
    }>();
    readonly variablesRequests: Map<number, {
        frameId: number;
        variablesReference: number;
        scope: 'local' | 'global';
    }> = new Map();
    _currentFrameId: number | undefined;

    async currentFrameId(): Promise<number> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._currentFrameId!;
    }
    setFrameId(frameId: number | undefined): void {
        this._currentFrameId = frameId;
    }

    onScopesRequest(request: DebugProtocol.ScopesRequest): void {
        const requestId = request.seq;
        const frameId = request.arguments.frameId;
        this.scopesRequests.set(requestId, { frameId });
    }

    onScopesResponse(response: DebugProtocol.ScopesResponse): void {
        const request = this.scopesRequests.get(response.request_seq);
        if (request !== undefined) {
            const frameId = request.frameId;
            this.scopesRequests.delete(response.request_seq);
            const [global, local] = response.body.scopes;
            this.frameForVariableReference.set(local.variablesReference, { frameId, scope: 'local' });
            this.frameForVariableReference.set(global.variablesReference, { frameId, scope: 'global' });
        }
    }

    onVariablesRequest(request: DebugProtocol.VariablesRequest): void {
        const frame = this.frameForVariableReference.get(request.arguments.variablesReference);
        if (frame !== undefined) {
            this.variablesRequests.set(request.seq, {
                variablesReference: request.arguments.variablesReference,
                ...frame
            });
        }
    }

    onVariablesResponse(response: DebugProtocol.VariablesResponse): void {
        const request = this.variablesRequests.get(response.request_seq);
        if (request !== undefined) {
            const frameId = request.frameId;
            this.variablesRequests.delete(response.request_seq);
            if (request.scope === 'local') {
                this.localVariables.length = 0;
            } else {
                this.globalVariables.length = 0;
            }
            const variablesForScope = request.scope === 'local' ? this.localVariables : this.globalVariables;
            this._currentFrameId = frameId;
            for (const variable of response.body.variables) {
                variablesForScope.push({
                    name: variable.name,
                    evaluateName: variable.evaluateName ?? variable.name,
                    frameId,
                    type: variable.type ?? 'unknown'
                });
            }
        }
    }

    onContinued(): void {
        //
    }

    getVariable(name: string): TrackedVariable | undefined {
        return this.localVariables.find((v) => v.evaluateName === name)
            ?? this.globalVariables.find((v) => v.evaluateName === name);
    }

    async currentFrameVariables(): Promise<{ locals: TrackedVariable[], globals: TrackedVariable[] }> {
        return {
            locals: this.localVariables.filter((v) => v.frameId === this._currentFrameId),
            globals: this.globalVariables.filter((v) => v.frameId === this._currentFrameId)
        }
    }
}

function patchDebugVariableContext(variablesResponse: DebugProtocol.VariablesResponse) {
    const viewableTypes = [
        "AxesSubplot",
        "Figure",
    ]
    variablesResponse.body.variables.forEach((v) => {
        if (v.type && viewableTypes.includes(v.type)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (v as any).__vscodeVariableMenuContext = 'viewableInGraphicViewer';
        }
    });
}

// register watcher for the debugging session. used to identify the running-frame,
// so multi-thread will work
// inspired from https://github.com/microsoft/vscode/issues/30810#issuecomment-590099482
export const createDebugAdapterTracker = (): vscode.DebugAdapterTracker => {
    type Request<T> = T & { type: 'request' };
    type Response<T> = T & { type: 'response' };
    type WithEvent<T, Event> = T & { type: 'event', event: Event }
    type WithCommand<T, Command> = T & { command: Command }
    type RecvMsg =
        WithCommand<Request<DebugProtocol.ScopesRequest>, "scopes">
        | WithCommand<Request<DebugProtocol.VariablesRequest>, 'variables'>
        | WithCommand<Request<DebugProtocol.EvaluateRequest>, 'evaluate'>

    type SendMsg =
        WithEvent<DebugProtocol.StoppedEvent, "stopped">
        | WithEvent<DebugProtocol.ContinuedEvent, "continued">
        | WithCommand<Response<DebugProtocol.VariablesResponse>, "variables">
        | WithCommand<Response<DebugProtocol.ScopesResponse>, "scopes">

    const variablesList = Container.get(VariablesList);
    const watchTreeProvider = Container.get(WatchTreeProvider);
    const debugVariablesTrackerService = Container.get(DebugVariablesTracker);

    return {
        // onWillStartSession: () => { },

        onWillStopSession: () => {
            variablesList.clear();
            watchTreeProvider.refresh();
        },

        onWillReceiveMessage: async (msg: RecvMsg) => {
            if (msg.type === "request" && msg.command === "scopes") {
                return debugVariablesTrackerService.onScopesRequest(msg);
            } else if (msg.type === "request" && msg.command === "variables") {
                return debugVariablesTrackerService.onVariablesRequest(msg);
            } else if (msg.type === "request" && msg.command === "evaluate" && /^\s*$/.test(msg.arguments.expression)) {
                // this is our call, in "update-frame-id" command.
                return debugVariablesTrackerService.setFrameId(msg.arguments.frameId);
            }
        },

        onDidSendMessage: async (msg: SendMsg) => {

            if (msg.type === "event" && msg.event === "stopped" && msg.body.threadId !== undefined) {
                const updateWatchView = () => {
                    return variablesList
                        .updateVariables()
                        .then(() => watchTreeProvider.refresh())
                        .then(saveTracked)
                        .catch((e) => logTrace(e));
                };
                return setTimeout(updateWatchView, 100); // wait a bit for the variables to be updated

            } else if (msg.type === 'response' && msg.command === 'variables') {
                if (msg.body && getConfiguration('addViewContextEntryToVSCodeDebugVariables')) patchDebugVariableContext(msg);
                return debugVariablesTrackerService.onVariablesResponse(msg);
            } else if (msg.type === "event" && msg.event === "continued") {
                return debugVariablesTrackerService.onContinued();
            } else if (msg.type === "response" && msg.command === "scopes") {
                return debugVariablesTrackerService.onScopesResponse(msg);
            }
        },
    };
};

