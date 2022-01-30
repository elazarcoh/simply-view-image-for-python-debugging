import { setTimeout } from 'timers';
import * as vscode from 'vscode';
import { DebugProtocol } from "vscode-debugprotocol";

type TrackedVariable = {
    evaluateName: string;
    frameId: number;
};

async function findCurrentFrameId() {
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.selection.isEmpty) {
        await vscode.commands.executeCommand('editor.debug.action.selectionToRepl', {})
    }
}

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

        await findCurrentFrameId()
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
        this._currentFrameId = frameId;
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
            const variablesForScope = request.scope === 'local' ? this.localVariables : this.globalVariables;
            for (const variable of response.body.variables) {
                variablesForScope.push({
                    evaluateName: variable.evaluateName ?? variable.name,
                    frameId
                });
            }
        }
    }

    onContinued(): void {
        this.localVariables.length = 0;
        this.globalVariables.length = 0;
    }

    getVariable(name: string): TrackedVariable | undefined {
        return this.localVariables.find((v) => v.evaluateName === name)
            ?? this.globalVariables.find((v) => v.evaluateName === name);
    }
}

let _debugVariablesTracker: DebugVariablesTracker;
export function debugVariablesTrackerService(): DebugVariablesTracker {
    _debugVariablesTracker ?? (_debugVariablesTracker = new DebugVariablesTracker());
    return _debugVariablesTracker;
}