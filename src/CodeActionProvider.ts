import type { TypedCommand } from './commands';
import { Option } from 'ts-results';
import * as vscode from 'vscode';
import { findExpressionViewables } from './PythonObjectInfo';
import { findJupyterSessionByDocumentUri } from './session/jupyter/JupyterSessionRegistry';
import { maybeDebugSession } from './session/Session';
import { getSessionData } from './session/SessionData';
import { arrayUniqueByKey } from './utils/Utils';
import { currentUserSelection, selectionString } from './utils/VSCodeUtils';

export class CodeActionProvider implements vscode.CodeActionProvider {
  // Since calling the findExpressionViewables might be expensive,
  // had a timeout of 1 second to avoid calling it too often.
  _lastCall: number = 0;

  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): Promise<TypedCommand<'svifpd._internal_view-object'>[] | undefined> {
    const session = Option.or(
      maybeDebugSession(vscode.debug.activeDebugSession),
      findJupyterSessionByDocumentUri(document.uri),
    );

    if (session.none) {
      return undefined;
    }
    const sessionData = getSessionData(session.val);
    if (!sessionData?.canExecute) {
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
      session.val,
    );
    if (objectViewables.err) {
      return undefined;
    }

    return arrayUniqueByKey(objectViewables.safeUnwrap(), t => t.title).map(
      viewable => ({
        title: `View ${viewable.title}`,
        command: 'svifpd._internal_view-object',
        arguments: [{ obj: userSelection, viewable, session: session.val }],
      }),
    );
  }
}
