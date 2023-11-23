import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { stringifyPython } from "./BuildPythonCode";
import { parsePythonResult } from "./PythonValueParser";
import { Err, Ok, Result } from "../utils/Result";

function runThroughDebugger(
    session: vscode.DebugSession,
    expression: string,
    { context, frameId }: RunInPythonOptions
): Thenable<BodyOf<DebugProtocol.EvaluateResponse>> {
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
): Promise<Result<R>>;
export async function runPython<R>(
    code: EvalCodePython<R>,
    parse: false,
    session: vscode.DebugSession,
    options: RunInPythonOptions
): Promise<Result<null>>;
export async function runPython<R>(
    code: EvalCodePython<R>,
    parse: boolean,
    session: vscode.DebugSession,
    options: RunInPythonOptions
): Promise<Result<R | null>> {
    try {
        const res = await runThroughDebugger(session, code.pythonCode, options);
        if (parse) {
            const parsed = parsePythonResult<R>(res.result);
            return parsed;
        } else {
            return Ok(null);
        }
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("SyntaxError")) {
                return Err("Syntax error");
            } else {
                return Err(error.message);
            }
        } else {
            return Err(JSON.stringify(error));
        }
    }
}

export function execInPython(
    evalCodePython: EvalCodePython<unknown>,
    session: vscode.DebugSession,
    options: RunInPythonOptions = { context: "repl" }
): Promise<Result<null>> {
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
): Promise<Result<R>> {
    return runPython(stringifyPython(evalCodePython), true, session, options);
}
