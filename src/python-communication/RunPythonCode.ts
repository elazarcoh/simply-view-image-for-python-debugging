import Container from "typedi";
import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { DebugVariablesTracker } from "../debugger-utils/DebugVariablesTracker";
import { Except } from "../utils/Except";
import { parsePythonValue } from "./PythonValueParser";

const debugVariablesTracker = Container.get(DebugVariablesTracker);

function runThroughDebugger(
    session: vscode.DebugSession,
    expression: string,
    frameId?: number
): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    return (frameId === undefined ? debugVariablesTracker.currentFrameId() : Promise.resolve(frameId))
        .then((frameId) => {
            return session.customRequest("evaluate", {
                expression: expression,
                frameId,
                context: "hover",
            });
        });
}

async function runPython<T = unknown>(code: string, session?: vscode.DebugSession): Promise<Except<T>> {
    session = session ?? vscode.debug.activeDebugSession;
    if (session === undefined) {
        return Except.error("no active debug session");
    }
    try {
        const res = await runThroughDebugger(session, code);
        return parsePythonValue<T>(res.result);
    } catch (error) {
        if (error instanceof Error) {
            return Except.error(error.message);
        } else {
            return Except.error(JSON.stringify(error));
        }
    }
}


export async function execInPython(code: string, session?: vscode.DebugSession): Promise<Except<null>> {
    code = `
exec(\"\"\"
${code}
\"\"\"
)
`;
    return runPython<null>(code, session);
}

export async function evaluateInPython<T = unknown>(expression: string, session?: vscode.DebugSession): Promise<Except<T>> {
    return runPython<T>(expression, session);
}