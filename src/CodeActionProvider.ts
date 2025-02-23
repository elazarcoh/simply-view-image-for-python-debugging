import * as vscode from "vscode";
import { TypedCommand } from "./commands";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";
import { findExpressionViewables } from "./PythonObjectInfo";
import { arrayUniqueByKey } from "./utils/Utils";
import { currentUserSelection, selectionString } from "./utils/VSCodeUtils";
import { debugSession } from "./session/Session";

export class CodeActionProvider implements vscode.CodeActionProvider {
  // Since calling the findExpressionViewables might be expensive,
  // had a timeout of 1 second to avoid calling it too often.
  _lastCall: number = 0;

  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): Promise<TypedCommand<"svifpd._internal_view-object">[] | undefined> {
    const session = vscode.debug.activeDebugSession;
    if (session === undefined) {
      return undefined;
    }
    const debugSessionData = activeDebugSessionData(session);
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
      debugSession(session),
    );
    if (objectViewables.err) {
      return undefined;
    }

    return arrayUniqueByKey(objectViewables.safeUnwrap(), (t) => t.title).map(
      (viewable) => ({
        title: `View ${viewable.title}`,
        command: "svifpd._internal_view-object",
        arguments: [userSelection, viewable, debugSession(session)],
      }),
    );
  }
}
