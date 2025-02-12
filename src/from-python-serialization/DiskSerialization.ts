import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { logDebug, logError } from "../Logging";
import { isExpressionSelection } from "../utils/VSCodeUtils";
import { constructValueWrappedExpressionFromEvalCode } from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { errorMessage, joinResult } from "../utils/Result";

export async function serializePythonObjectToDisk(
  obj: PythonObjectRepresentation,
  viewable: Viewable,
  session: vscode.DebugSession,
  path?: string,
): Promise<string | undefined> {
  const debugSessionData = activeDebugSessionData(session);
  path = path ?? debugSessionData.savePathHelper.savePathFor(obj);
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
  const mkdirRes = debugSessionData.savePathHelper.mkdir();
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
    }: ${errorMessage(result)}`.replaceAll("\\n", "\n");
    logError(message);
    vscode.window.showErrorMessage(message);
  } else {
    return pathWithSuffix;
  }
}
