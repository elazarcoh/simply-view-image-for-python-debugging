import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { Body } from "./utils";

class PythonInContextExecutor implements IStackWatcher {
  protected threadId = 0;
  protected frameId = 0;

  public setThreadId(threadId: number) {
    this.threadId = threadId;
  }

  public setFrameId(frameId: number) {
    this.frameId = frameId;
  }

  public evaluate(
    session: vscode.DebugSession,
    expression: string
  ): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    return session.customRequest("evaluate", {
      expression: expression,
      frameId: this.frameId,
      context: "hover",
    });
  }
}

let _pythonInContextExecutor: PythonInContextExecutor;
export function pythonInContextExecutor(): PythonInContextExecutor {
  _pythonInContextExecutor ??
    (_pythonInContextExecutor = new PythonInContextExecutor());
  return _pythonInContextExecutor;
}
