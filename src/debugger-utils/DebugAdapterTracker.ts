import * as vscode from "vscode";
import Container from "typedi";
import { DebugProtocol } from "vscode-debugprotocol";
import { logDebug, logTrace } from "../Logging";
import { DebugVariablesTracker } from "./DebugVariablesTracker";
import { DebugSessionsHolder } from "./DebugSessionsHolder";
import { execInPython } from "../python-communication/RunPythonCode";
import { viewablesSetupCode } from "../python-communication/BuildPythonCode";

// register watcher for the debugging session. used to identify the running-frame,
// so multi-thread will work
// inspired from https://github.com/microsoft/vscode/issues/30810#issuecomment-590099482
export const createDebugAdapterTracker = (
    session: vscode.DebugSession
): vscode.DebugAdapterTracker => {
    type Request<T> = T & { type: "request" };
    type Response<T> = T & { type: "response" };
    type WithEvent<T, Event> = T & { type: "event"; event: Event };
    type WithCommand<T, Command> = T & { command: Command };
    type RecvMsg =
        | WithCommand<Request<DebugProtocol.ScopesRequest>, "scopes">
        | WithCommand<Request<DebugProtocol.VariablesRequest>, "variables">
        | WithCommand<Request<DebugProtocol.EvaluateRequest>, "evaluate">;

    type SendMsg =
        | WithEvent<DebugProtocol.StoppedEvent, "stopped">
        | WithEvent<DebugProtocol.ContinuedEvent, "continued">
        | WithCommand<Response<DebugProtocol.VariablesResponse>, "variables">
        | WithCommand<Response<DebugProtocol.ScopesResponse>, "scopes">;

    // const variablesList = Container.get(VariablesList);
    // const watchTreeProvider = Container.get(WatchTreeProvider);

    const debugSessionData =
        Container.get(DebugSessionsHolder).debugSessionData(session);
    const debugVariablesTracker = debugSessionData.debugVariablesTracker;

    return {
        onWillStartSession: () => {
            logTrace("onWillStartSession");
        },

        onWillStopSession: () => {
            logTrace("onWillStopSession");
            // variablesList.clear();
            // watchTreeProvider.refresh();
        },

        onWillReceiveMessage: async (msg: RecvMsg) => {
            logTrace("onWillReceiveMessage", msg);
            if (msg.type === "request" && msg.command === "scopes") {
                return debugVariablesTracker.onScopesRequest(msg);
            } else if (msg.type === "request" && msg.command === "variables") {
                return debugVariablesTracker.onVariablesRequest(msg);
            } else if (
                msg.type === "request" &&
                msg.command === "evaluate" &&
                /^\s*$/.test(msg.arguments.expression)
            ) {
                // this is our call, in "update-frame-id" command.
                return debugVariablesTracker.setFrameId(msg.arguments.frameId);
            }
        },

        onDidSendMessage: async (msg: SendMsg) => {
            logTrace("onDidSendMessage", msg);

            // breakpoint hit
            if (
                msg.type === "event" &&
                msg.event === "stopped" &&
                msg.body.threadId !== undefined
            ) {
                logDebug("Breakpoint hit");
                logDebug("Executing Extension Setup Code");
                await execInPython(viewablesSetupCode(), session);
                logDebug("Extension Setup Code Execution Complete");
                //     const updateWatchView = () => {
                //         return variablesList
                //             .updateVariables()
                //             .then(() => watchTreeProvider.refresh())
                //             .then(saveTracked)
                //             .catch((e) => logTrace(e));
                //     };
                // return setTimeout(updateWatchView, 100); // wait a bit for the variables to be updated
            } else if (msg.type === "response" && msg.command === "variables") {
                //     // Add context to debug variable. This is a workaround.
                //     if (msg.body && getConfiguration('addViewContextEntryToVSCodeDebugVariables')) patchDebugVariableContext(msg);
                return debugVariablesTracker.onVariablesResponse(msg);
            } else if (msg.type === "event" && msg.event === "continued") {
                return debugVariablesTracker.onContinued();
            } else if (msg.type === "response" && msg.command === "scopes") {
                return debugVariablesTracker.onScopesResponse(msg);
            }
        },

        onError: (error: Error) => {
            logTrace("onError");
        },

        onExit: (code: number, signal: string) => {
            logTrace("onExit");
        },
    };
};
