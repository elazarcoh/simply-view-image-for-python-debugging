import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { findExpressionViewables } from "../PythonObjectInfo";
import { viewObject } from "../ViewPythonObject";

// update currently selected frame, using a hacky way (because the vscode API is lacking).
export async function updateDebugFrameId(): Promise<void> {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor) {
    const prevSelection = activeTextEditor.selection;
    let whitespaceLocation = null;
    for (
      let i = 0;
      i < activeTextEditor.document.lineCount && whitespaceLocation === null;
      i++
    ) {
      const line = activeTextEditor.document.lineAt(i);
      const whitespaceIndex = line.text.search(/\s/);
      if (whitespaceIndex !== -1) {
        whitespaceLocation = new vscode.Position(i, whitespaceIndex);
      }
    }
    if (whitespaceLocation === null) return;
    activeTextEditor.selection = new vscode.Selection(
      whitespaceLocation,
      whitespaceLocation.translate({ characterDelta: 1 }),
    );
    await vscode.commands
      .executeCommand("editor.debug.action.selectionToRepl", {})
      .then(() => {
        activeTextEditor.selection = prevSelection;
      });
  }
}

/**
 * Patch the VariableResponse from the debugger with context value to make it viewable
 */
export function patchDebugVariableContext(
  variablesResponse: DebugProtocol.VariablesResponse,
): void {
  const viewableTypes = ["AxesSubplot", "Figure"];
  variablesResponse.body.variables.forEach((v) => {
    if (v.type !== undefined && viewableTypes.includes(v.type)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v as any).__vscodeVariableMenuContext = "viewableInGraphicViewer";
    }
  });
}

export async function viewVariableFromVSCodeDebugViewAsImage({
  variable,
}: {
  variable: DebugProtocol.Variable;
}): Promise<void> {
  const debugSession = vscode.debug.activeDebugSession;
  if (debugSession === undefined || variable.evaluateName === undefined) {
    return undefined;
  }

  const objectViewables = await findExpressionViewables(
    variable.evaluateName,
    debugSession,
  );

  if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
    return undefined;
  }

  return viewObject(
    { variable: variable.evaluateName },
    objectViewables.safeUnwrap()[0],
    debugSession,
  );
}
