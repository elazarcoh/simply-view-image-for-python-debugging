import type { SavePathHelper } from '../SerializationHelper';
import type { Session } from '../session/Session';
import type { Viewable } from '../viewable/Viewable';
import * as vscode from 'vscode';
import { logDebug, logError } from '../Logging';
import { constructValueWrappedExpressionFromEvalCode } from '../python-communication/BuildPythonCode';
import { evaluateInPython } from '../python-communication/RunPythonCode';
import { activeDebugSessionData } from '../session/debugger/DebugSessionsHolder';
import { jupyterSessionData } from '../session/jupyter/JupyterSessionRegistry';
import { isDebugSession } from '../session/Session';
import { errorMessage, joinResult } from '../utils/Result';
import { isExpressionSelection } from '../utils/VSCodeUtils';

export async function serializePythonObjectToDisk(
  obj: PythonObjectRepresentation,
  viewable: Viewable,
  session: Session,
  path?: string,
): Promise<string | undefined> {
  let savePathHelper: SavePathHelper;
  if (isDebugSession(session)) {
    const debugSessionData = activeDebugSessionData(session.session);
    savePathHelper = debugSessionData.savePathHelper;
  }
  else {
    const data = jupyterSessionData(session.uri);
    if (!data) {
      logError('Jupyter session data not found');
      return;
    }
    savePathHelper = data.savePathHelper;
  }
  path = path ?? savePathHelper.savePathFor(obj);

  logDebug(`Saving viewable of type ${viewable.type} to ${path}`);
  const objectAsString = isExpressionSelection(obj)
    ? obj.expression
    : obj.variable;
  const pathWithSuffix = `${path}${viewable.suffix}`;
  const saveObjectCode = constructValueWrappedExpressionFromEvalCode(
    viewable.serializeObjectPythonCode,
    objectAsString,
    pathWithSuffix,
  );
  const mkdirRes = savePathHelper.mkdir();
  if (mkdirRes.err) {
    const message = `Failed to create directory for saving object: ${errorMessage(
      mkdirRes,
    )}`;
    logError(message);
    vscode.window.showErrorMessage(message);
    return;
  }
  const result = joinResult(await evaluateInPython(saveObjectCode, session));

  if (result.err) {
    const message = `Error saving viewable of type ${
      viewable.type
    }: ${errorMessage(result)}`.replaceAll('\\n', '\n');
    logError(message);
    vscode.window.showErrorMessage(message);
  }
  else {
    return pathWithSuffix;
  }
}
