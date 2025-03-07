import * as vscode from "vscode";
import { TypedCommand } from "./commands";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";
import { findExpressionViewables } from "./PythonObjectInfo";
import { arrayUniqueByKey } from "./utils/Utils";
import { currentUserSelection, selectionString } from "./utils/VSCodeUtils";

export class CodeActionProvider implements vscode.CodeActionProvider {
  // Since calling the findExpressionViewables might be expensive,
  // had a timeout of 1 second to avoid calling it too often.
  _lastCall: number = 0;

  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): Promise<TypedCommand<"svifpd._internal_view-object">[] | undefined> {
    const debugSession = vscode.debug.activeDebugSession;
    if (debugSession === undefined) {
      return undefined;
    }
    const debugSessionData = activeDebugSessionData(debugSession);
    if (
      debugSessionData.isStopped === false ||
      debugSessionData.setupOkay === false
    ) {
      return undefined;
    }

    const userSelection = currentUserSelection(document, range);
    if (userSelection === undefined) {
      return;
    }

    if (Date.now() - this._lastCall < 1000) {
      return undefined;
    }
    setTimeout(() => {
      this._lastCall = Date.now();
    });
    const objectViewables = await findExpressionViewables(
      selectionString(userSelection),
      debugSession,
    );
    if (objectViewables.err) {
      return undefined;
    }

    return arrayUniqueByKey(objectViewables.safeUnwrap(), (t) => t.title).map(
      (viewable) => ({
        title: `View ${viewable.title}`,
        command: "svifpd._internal_view-object",
        arguments: [userSelection, viewable, debugSession],
      }),
    );
  }
}
