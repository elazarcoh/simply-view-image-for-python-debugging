import * as vscode from "vscode";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";
import {
    currentUserSelection,
    selectionString,
    openImageToTheSide,
    isExpressionSelection,
} from "./utils/VSCodeUtils";
import { Viewable } from "./viewable/Viewable";
import { evaluateInPython } from "./python-communication/RunPythonCode";
import { constructValueWrappedExpressionFromEvalCode } from "./python-communication/BuildPythonCode";
import { findExpressionViewables } from "./PythonObjectInfo";
import { logDebug, logError } from "./Logging";

export async function viewObject(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession,
    path?: string
): Promise<void> {
    const debugSessionData = activeDebugSessionData(session);
    path = path ?? debugSessionData.savePathHelper.savePathFor(obj);
    logDebug(`Saving viewable of type ${viewable.type} to ${path}`);
    const objectAsString = isExpressionSelection(obj)
        ? obj.expression
        : obj.variable;
    const code = constructValueWrappedExpressionFromEvalCode(
        viewable.serializeObjectPythonCode,
        objectAsString,
        path
    );
    const result = await evaluateInPython(code, session);
    const errorMessage = result.isError
        ? result.errorMessage
        : result.result.isError
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
        await openImageToTheSide(path, true);
    }
}

export async function viewObjectUnderCursor(): Promise<unknown> {
    const debugSession = vscode.debug.activeDebugSession;
    const document = vscode.window.activeTextEditor?.document;
    const range = vscode.window.activeTextEditor?.selection;
    if (
        debugSession === undefined ||
        document === undefined ||
        range === undefined
    ) {
        return undefined;
    }

    const userSelection = currentUserSelection(document, range);
    if (userSelection === undefined) {
        return;
    }

    const objectViewables = await findExpressionViewables(
        selectionString(userSelection),
        debugSession
    );
    if (objectViewables === undefined || objectViewables.length === 0) {
        return undefined;
    }

    return viewObject(userSelection, objectViewables[0], debugSession);
}
