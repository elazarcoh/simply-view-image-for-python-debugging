import * as vscode from "vscode";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";
import {
    currentUserSelection,
    selectionString,
    openImageToTheSide,
} from "./utils/VSCodeUtils";
import { Viewable } from "./viewable/Viewable";
import { findExpressionViewables } from "./PythonObjectInfo";
import Container from "typedi";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { Except } from "./utils/Except";
import { serializePythonObjectToDisk } from "./from-python-serialization/DiskSerialization";

export async function viewObject(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession,
    path?: string,
    openInPreview?: boolean
): Promise<void> {
    const resPath = await serializePythonObjectToDisk(
        obj,
        viewable,
        session,
        path
    );
    if (resPath !== undefined) {
        if (viewable.onShow !== undefined) {
            await viewable.onShow(resPath);
        } else {
            await openImageToTheSide(resPath, openInPreview ?? true);
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
