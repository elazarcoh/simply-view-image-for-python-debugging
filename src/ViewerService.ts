import * as vscode from "vscode";
import { join } from "path";
import {
  isVariableSelection,
  UserSelection,
  VariableSelection,
} from "./PythonSelection";
import { pythonInContextExecutor } from "./PythonInContextExecutor";
import * as tmp from "tmp";
import { DebugProtocol } from "vscode-debugprotocol";
import type { Body } from "./utils";

export type VariableInformation = {
  name: string;
  // watchCommand: vscode.Command
  more: Record<string, string>;
};

export abstract class ViewerService {
  protected currentIdx: number = 0;

  public constructor(
    protected readonly workingDir: string,
    protected readonly inContextExecutor = pythonInContextExecutor()
  ) {}

  protected get currentImgIdx(): number {
    this.currentIdx = (this.currentIdx + 1) % 10;
    return this.currentIdx;
  }

  abstract variableInformation(
    userSelection: VariableSelection
  ): Promise<VariableInformation | undefined>;
  abstract save(
    userSelection: UserSelection,
    path?: string
  ): Promise<string | undefined>;

  public pathForSelection(userSelection: UserSelection): string {
    if (isVariableSelection(userSelection)) {
      return join(
        this.workingDir,
        `${userSelection.variable}(${this.currentImgIdx}).png`
      );
    } else {
      const options = { postfix: ".png", dir: this.workingDir };
      return tmp.tmpNameSync(options);
    }
  }

  protected evaluate(
    session: vscode.DebugSession,
    expression: string
  ): Thenable<Body<DebugProtocol.EvaluateResponse>> {
    return this.inContextExecutor.evaluate(session, expression);
  }
}
