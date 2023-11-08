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
import { getConfiguration } from "./config";
import { serializePythonObjectUsingSocketServer } from "./from-python-serialization/SocketSerialization";
import { logDebug } from "./Logging";
import { parseMessage } from "./python-communication/socket-based/protocol";
import { WebviewClient } from "./webview/communication/WebviewClient";

export async function viewObject(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession,
    path?: string,
    openInPreview?: boolean
): Promise<void> {
    if (getConfiguration("useExperimentalViewer", undefined, false) === true) {
        const response = await serializePythonObjectUsingSocketServer(
            obj,
            viewable,
            session
        );
        if (response !== undefined) {
            // parse response
            const { header, data } = response;
            const message = parseMessage(header, data);
            logDebug("Parsed message from client", message);
            if (Except.isError(message)) {
                throw new Error("Error parsing message from client");
            }
            const arrayInfo = message.result;
            const len = arrayInfo.dimensions.reduce((a, b) => a * b, 1) * 4;
            const arrayBuffer = new ArrayBuffer(len);
            const arrayData = new Uint8Array(arrayBuffer);
            arrayData.set(arrayInfo.data);

            // @ts-expect-error  // TODO: fix this
            const channels: 1 | 2 | 3 | 4 = arrayInfo.dimensions[2] ?? 1;
            const webviewClient = Container.get(WebviewClient);
            webviewClient.reveal();
            webviewClient.sendResponse("foobar-id", {
                type: "ImageData",
                width: arrayInfo.dimensions[1],
                height: arrayInfo.dimensions[0],
                channels,
                // TODO: variable or expression?
                value_variable_kind: "variable",
                image_id: "foobar-id",
                expression: "foobar-expression",
                datatype: "float32",
                bytes: arrayBuffer,
                additional_info: {},
            });
        }
    } else {
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
