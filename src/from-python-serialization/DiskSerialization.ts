import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { logDebug, logError } from "../Logging";
import { isExpressionSelection } from "../utils/VSCodeUtils";
import { constructValueWrappedExpressionFromEvalCode } from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { Except } from "../utils/Except";

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
        pathWithSuffix
    );
    const mkdirRes = debugSessionData.savePathHelper.mkdir();
    if (mkdirRes.isError) {
        const message = `Failed to create directory for saving object: ${mkdirRes.errorMessage}`;
        logError(message);
        vscode.window.showErrorMessage(message);
        return
    }
    const result = await evaluateInPython(saveObjectCode, session);
    const errorMessage = Except.isError(result)
        ? result.errorMessage
        : Except.isError(result.result)
        ? result.result.errorMessage
        : undefined;
    if (errorMessage !== undefined) {
        const message =
            `Error saving viewable of type ${viewable.type}: ${errorMessage}`.replaceAll(
                "\\n",
                "\n"
            );
        logError(message);
        vscode.window.showErrorMessage(message);
    } else {
        return pathWithSuffix;
    }
}