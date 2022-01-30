import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { debugVariablesTrackerService } from "./DebugVariablesTracker";
import { Body } from "./utils";

class PythonInContextExecutor {

  public evaluate(
    session: vscode.DebugSession,
    expression: string
  ): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    return debugVariablesTrackerService().currentFrameId().then((frameId) => {
      return session.customRequest("evaluate", {
        expression: expression,
        frameId,
        context: "hover",
      });
    });
  }
}

let _pythonInContextExecutor: PythonInContextExecutor;
export function pythonInContextExecutor(): PythonInContextExecutor {
  _pythonInContextExecutor ??
    (_pythonInContextExecutor = new PythonInContextExecutor());
  return _pythonInContextExecutor;
}
