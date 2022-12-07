import Container from "typedi";
import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { DebugSessionsHolder } from "../debugger-utils/DebugSessionsHolder";
import { Except } from "../utils/Except";
import { parsePythonValue } from "./PythonValueParser";

function runThroughDebugger(
    session: vscode.DebugSession,
    expression: string,
    { context, frameId }: RunInPythonOptions
): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    const debugVariablesTracker =
        Container.get(DebugSessionsHolder).debugSessionData(
            session
        ).debugVariablesTracker;

    frameId = frameId ?? debugVariablesTracker.currentFrameId();

    return session.customRequest("evaluate", {
        expression: expression,
        frameId,
        context,
    });
}

async function runPython<T>(
    code: string,
    parse: false,
    isMultiResults: boolean,
    session?: vscode.DebugSession,
    options?: RunInPythonOptions
): Promise<Except<null>>;
async function runPython<T>(
    code: string,
    parse: true,
    isMultiResults: false,
    session?: vscode.DebugSession,
    options?: RunInPythonOptions
): Promise<Except<T>>;
async function runPython<T>(
    code: string,
    parse: true,
    isMultiResults: true,
    session?: vscode.DebugSession,
    options?: RunInPythonOptions
): Promise<Except<T>[]>;
async function runPython<T>(
    code: string,
    parse: boolean,
    isMultiResults: boolean,
    session?: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Except<T | null> | Except<T>[]> {
    session = session ?? vscode.debug.activeDebugSession;
    if (session === undefined) {
        return Except.error("no active debug session");
    }
    try {
        const res = await runThroughDebugger(session, code, options);
        if (parse) {
            return isMultiResults
                ? parsePythonValue<T>(res.result, true)
                : parsePythonValue<T>(res.result, false);
        } else {
            return Except.result(null);
        }
    } catch (error) {
        if (error instanceof Error) {
            return Except.error(error.message);
        } else {
            return Except.error(JSON.stringify(error));
        }
    }
}

export async function execInPython(
    code: string,
    session?: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Except<null>> {
    code = `
exec(\"\"\"
${code}
\"\"\"
)
`;
    return runPython<null>(code, false, false, session, options);
}

export async function evaluateInPython<T = unknown>(
    expression: string,
    session?: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Except<T>> {
    return runPython<T>(expression, true, false, session, options);
}

export async function evaluateInPythonMulti<T = unknown>(
    expression: string,
    session?: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Except<T>[]> {
    return runPython<T>(expression, true, true, session, options);
}
