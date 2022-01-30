import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { debugVariablesTrackerService } from "./DebugVariablesTracker";
import { ScopeVariables, UserSelection, Variable } from "./PythonSelection";
import type { Body } from "./utils";

class PythonVariablesService {

  protected async variableNameOrExpression(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<UserSelection | undefined> {
    const selected = document.getText(range);
    if (selected !== "") {
      return { range: selected }; // the user selection
    }

    // const { locals, globals } = (await this.viewableVariables()) ?? {};

    // the user not selected a range. need to figure out which variable he's on
    const selectedVariable = document.getText(
      document.getWordRangeAtPosition(range.start)
    );
    const targetVariable = debugVariablesTrackerService().getVariable(selectedVariable);
    // const targetVariable =
    //   locals?.find((v) => v.name === selectedVariable) ??
      // globals?.find((v) => v.name === selectedVariable);

    if (targetVariable !== undefined) {
      return { variable: targetVariable.evaluateName }; // var name
    } else {
      return undefined;
    }
  }

  public async viewableVariables(): Promise<ScopeVariables | undefined> {
    const session = vscode.debug.activeDebugSession;
    if (session === undefined) {
      return;
    }

    const frameId = await debugVariablesTrackerService().currentFrameId();

    const res: Body<DebugProtocol.ScopesResponse> = await session.customRequest(
      "scopes",
      { frameId: frameId }
    );
    const scopes = res.scopes;
    const local = scopes[0];
    const global = scopes[1];

    const getVars = async (scope: DebugProtocol.Scope): Promise<Variable[]> => {
      try {
        const res: Body<DebugProtocol.VariablesResponse> =
          await session.customRequest("variables", {
            variablesReference: scope.variablesReference,
          });
        return res.variables
          .filter((v) => !v.name.includes(" ")) // filter obviously not variables
          .map((v) => ({
            name: v.name,
            evaluateName: v.evaluateName ?? v.name,
          }));
      } catch (error) {
        console.error(error);
        return [];
      }
    };

    const [localVariables, globalVariables] = await Promise.all([
      local ? getVars(local) : Promise.resolve([]),
      global ? getVars(global) : Promise.resolve([]),
    ]);

    return { locals: localVariables ?? [], globals: globalVariables ?? [] };
  }

  async userSelection(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<UserSelection | undefined> {
    const session = vscode.debug.activeDebugSession;
    if (session === undefined) {
      return;
    }
    const userSelection = await this.variableNameOrExpression(document, range);
    if (userSelection === undefined) {
      return;
    }
    return userSelection;
  }
}

let _pythonVariablesService: PythonVariablesService;
export function pythonVariablesService(): PythonVariablesService {
  _pythonVariablesService ??
    (_pythonVariablesService = new PythonVariablesService());
  return _pythonVariablesService;
}
