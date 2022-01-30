import * as vscode from "vscode";
import { debugVariablesTrackerService } from "./DebugVariablesTracker";
import { UserSelection } from "./PythonSelection";

class PythonVariablesService {

  protected async variableNameOrExpression(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<UserSelection | undefined> {
    const selected = document.getText(range);
    if (selected !== "") {
      return { range: selected }; // the user selection
    }

    // the user not selected a range. need to figure out which variable he's on
    const selectedVariable = document.getText(
      document.getWordRangeAtPosition(range.start)
    );
    const targetVariable = debugVariablesTrackerService().getVariable(selectedVariable);

    if (targetVariable !== undefined) {
      return { variable: targetVariable.evaluateName }; // var name
    } else {
      return undefined;
    }
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
