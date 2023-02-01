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
import Container from "typedi";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { Except } from "./utils/Except";

export async function viewObject(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession,
    path?: string,
    openInPreview?: boolean
): Promise<void> {
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
        return;
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
        if (viewable.onShow !== undefined) {
            await viewable.onShow(pathWithSuffix);
        } else {
            await openImageToTheSide(pathWithSuffix, openInPreview ?? true);
        }
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
    if (
        Except.isError(objectViewables) ||
        objectViewables.result.length === 0
    ) {
        return undefined;
    }

    return viewObject(userSelection, objectViewables.result[0], debugSession);
}

export async function trackObjectUnderCursor(): Promise<unknown> {
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
    const userSelectionAsString = selectionString(userSelection);

    // find if it is an existing expression in the list
    const debugSessionData = activeDebugSessionData(debugSession);
    const objectInList = debugSessionData.currentPythonObjectsList.find(
        userSelectionAsString
    );

    const objectViewables = await findExpressionViewables(
        userSelectionAsString,
        debugSession
    );

    // add as expression if not found
    if (objectInList === undefined) {
        await debugSessionData.currentPythonObjectsList.addExpression(
            userSelectionAsString
        );
    }
    let savePath: string | undefined = undefined;
    if (Except.isOkay(objectViewables) && objectViewables.result.length > 0) {
        const trackedPythonObjects = debugSessionData.trackedPythonObjects;
        const trackingId = trackedPythonObjects.trackingIdIfTracked({
            expression: userSelectionAsString,
        });
        const savePathIfSet = trackingId
            ? trackedPythonObjects.savePath(trackingId)
            : undefined;
        savePath =
            savePathIfSet ??
            debugSessionData.savePathHelper.savePathFor(userSelection);
        trackedPythonObjects.track(
            { expression: userSelectionAsString },
            objectViewables.result[0],
            savePath,
            trackingId
        );
    }

    Container.get(WatchTreeProvider).refresh();

    if (
        Except.isError(objectViewables) ||
        objectViewables.result.length === 0
    ) {
        return undefined;
    }

    return viewObject(
        userSelection,
        objectViewables.result[0],
        debugSession,
        savePath,
        false
    );
}
