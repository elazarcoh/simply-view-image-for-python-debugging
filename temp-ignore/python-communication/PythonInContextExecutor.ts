import * as vscode from "vscode";
import { Service } from "typedi";
import { DebugProtocol } from "vscode-debugprotocol";
import { DebugVariablesTracker } from "../../debugger-utils/DebugVariablesTracker";

@Service()
export class PythonInContextExecutor {

  constructor(private readonly debugVariablesTracker: DebugVariablesTracker) { }

  public evaluate(
    session: vscode.DebugSession,
    expression: string,
    frameId?: number
  ): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    return (frameId === undefined ? this.debugVariablesTracker.currentFrameId() : Promise.resolve(frameId))
      .then((frameId) => {
        return session.customRequest("evaluate", {
          expression: expression,
          frameId,
          context: "hover",
        });
      });
  }
}
