import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { Except } from "../utils/Except";
import { stringifyPython } from "./BuildPythonCode";
import { parsePythonResult } from "./PythonValueParser";

function runThroughDebugger(
    session: vscode.DebugSession,
    expression: string,
    { context, frameId }: RunInPythonOptions
): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    const debugVariablesTracker =
        activeDebugSessionData(session).debugVariablesTracker;

    frameId = frameId ?? debugVariablesTracker.currentFrameId();

    return session.customRequest("evaluate", {
        expression,
        frameId,
        context,
    } as DebugProtocol.EvaluateArguments);
}

export async function runPython<R>(
    code: EvalCodePython<R>,
    parse: true,
    session: vscode.DebugSession,
    options: RunInPythonOptions
): Promise<Except<R>>;
export async function runPython<R>(
    code: EvalCodePython<R>,
    parse: false,
    session: vscode.DebugSession,
    options: RunInPythonOptions
): Promise<Except<null>>;
export async function runPython<R>(
    code: EvalCodePython<R>,
    parse: boolean,
    session: vscode.DebugSession,
    options: RunInPythonOptions
): Promise<Except<R | null>> {
    try {
        const res = await runThroughDebugger(session, code.pythonCode, options);
        if (parse) {
            const parsed = parsePythonResult<R>(res.result);
            return parsed;
        } else {
            return Except.result(null);
        }
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("SyntaxError")) {
                return Except.error("Syntax error");
            } else {
                return Except.error(error.message);
            }
        } else {
            return Except.error(JSON.stringify(error));
        }
    }
}

export function execInPython(
    evalCodePython: EvalCodePython<unknown>,
    session: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Except<null>> {
    const code = {
        pythonCode: `
exec(\"\"\"
${evalCodePython.pythonCode}
\"\"\"
)
`,
    };
    return runPython(code, false, session, options);
}

export function evaluateInPython<R = unknown>(
    evalCodePython: EvalCodePython<R>,
    session: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Except<R>> {
    return runPython(stringifyPython(evalCodePython), true, session, options);
}
