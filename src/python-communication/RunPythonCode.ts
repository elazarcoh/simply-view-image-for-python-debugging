import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { stringifyPython } from "./BuildPythonCode";
import { parsePythonResult } from "./PythonValueParser";
import { Err, Ok, Result } from "../utils/Result";
import { Kernel } from "@vscode/jupyter-extension";
import { isDebugSession, isJupyterSession, Session } from "../session/Session";

// from https://github.com/microsoft/vscode-extension-samples/blob/main/jupyter-kernel-execution-sample/src/extension.ts
const ErrorMimeType = vscode.NotebookCellOutputItem.error(new Error("")).mime;
const textDecoder = new TextDecoder();
type ExecutionError = {
  name: string;
  message: string;
  stack: string;
};
async function* executeCodeStreamInKernel(
  code: string,
  kernel: Kernel,
): AsyncGenerator<Result<string>, void, unknown> {
  const tokenSource = new vscode.CancellationTokenSource();
  try {
    for await (const output of kernel.executeCode(code, tokenSource.token)) {
      for (const outputItem of output.items) {
        const decoded = textDecoder.decode(outputItem.data);
        if (outputItem.mime === ErrorMimeType) {
          const error = JSON.parse(decoded) as Error;
          yield Err({
            name: error.name,
            message: error.message,
            stack: error.stack,
          } as ExecutionError);
        } else {
          yield Ok(decoded);
        }
      }
    }
  } finally {
    tokenSource.dispose();
  }
}
async function runThroughJupyterKernel(
  code: string,
  kernel: Kernel,
): Promise<Result<string>> {
  let result = "";
  for await (const output of executeCodeStreamInKernel(code, kernel)) {
    if (output.err) {
      return output;
    } else if (output !== undefined) {
      result += output.val;
    }
  }
  return Ok(result);
}

function runThroughDebugger(
  session: vscode.DebugSession,
  expression: string,
  { context, frameId }: RunInPythonOptions,
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

async function runPython<R>(
  code: EvalCodePython<R>,
  parse: true,
  session: Session,
  options: RunInPythonOptions,
): Promise<Result<R>>;
async function runPython<R>(
  code: EvalCodePython<R>,
  parse: false,
  session: Session,
  options: RunInPythonOptions,
): Promise<Result<null>>;
async function runPython<R>(
  code: EvalCodePython<R>,
  parse: boolean,
  session: Session,
  options: RunInPythonOptions,
): Promise<Result<R | null>> {
  try {
    let retVal: string;
    if (isDebugSession(session)) {
      const res = await runThroughDebugger(
        session.session,
        code.pythonCode,
        options,
      );
      retVal = res.result;
    } else if (isJupyterSession(session)) {
      const res = await runThroughJupyterKernel(
        code.pythonCode,
        session.kernel,
      );
      if (res.err) {
        return res;
      }
      retVal = res.val;
    } else {
      return Err("Unknown session type");
    }

    if (parse) {
      const parsed = parsePythonResult<R>(retVal);
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
  session: Session,
  options: RunInPythonOptions = { context: "repl" },
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
  session: Session,
  options: RunInPythonOptions = { context: "repl" },
  stringify: boolean = true,
): Promise<Result<R>> {
  const code = stringify ? stringifyPython(evalCodePython) : evalCodePython;
  return runPython(code, true, session, options);
}
