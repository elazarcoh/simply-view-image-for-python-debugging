import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { debugVariablesTrackerService } from "./DebugVariablesTracker";
import { Body } from "./utils/utils";

class PythonInContextExecutor {
  public evaluate(
    session: vscode.DebugSession,
    expression: string,
    frameId?: number
  ): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    return (frameId === undefined ? debugVariablesTrackerService().currentFrameId() : Promise.resolve(frameId))
      .then((frameId) => {
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
