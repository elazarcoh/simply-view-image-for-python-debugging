import * as vscode from "vscode";
import { ScopeVariables, UserSelection, Variable } from "./PythonSelection";

class PythonVariablesService {
  protected threadId: number = 0;
  protected frameId: number = 0;

  public setThreadId(threadId: number) {
    this.threadId = threadId;
  }
  public setFrameId(frameId: number) {
    this.frameId = frameId;
  }

  protected async variableNameOrExpression(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<UserSelection | undefined> {
    const selected = document.getText(range);
    if (selected !== "") {
      return { range: selected }; // the user selection
    }

    // the user not selected a range. need to figure out which variable he's on
    const { locals, globals } = (await this.viewableVariables()) ?? {};

    const selectedVariable = document.getText(
      document.getWordRangeAtPosition(range.start)
    );
    const targetVariable =
      locals?.find((v) => v.name === selectedVariable) ??
      globals?.find((v) => v.name === selectedVariable);

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

    const frameId = this.frameId;

    let res = await session.customRequest("scopes", { frameId: frameId });
    const scopes = res.scopes;
    const local = scopes[0];
    const global = scopes[1];

    const getVars = async (scope: any): Promise<Variable[]> => {
      try {
        const res = await session.customRequest("variables", {
          variablesReference: scope.variablesReference,
        });
        return res.variables.filter(
          ({ name }: { name: string }) => !name.includes(" ")
        ); // filter obviously not variables
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
