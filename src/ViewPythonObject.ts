import * as vscode from "vscode";
import { activeDebugSessionData } from "./session/debugger/DebugSessionsHolder";
import {
  currentUserSelection,
  selectionString,
  openImageToTheSide,
} from "./utils/VSCodeUtils";
import { Viewable } from "./viewable/Viewable";
import { findExpressionViewables } from "./PythonObjectInfo";
import Container from "typedi";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { serializePythonObjectToDisk } from "./from-python-serialization/DiskSerialization";
import { getConfiguration } from "./config";
import { serializeImageUsingSocketServer } from "./from-python-serialization/SocketSerialization";
import { GlobalWebviewClient } from "./webview/communication/WebviewClient";
import { WebviewRequests } from "./webview/communication/createMessages";
import { logWarn } from "./Logging";
import { valueOrEval } from "./utils/Utils";
import { debugSession, Session } from "./session/Session";

export async function viewObject(
  obj: PythonObjectRepresentation,
  viewable: Viewable,
  session: Session,
  path?: string,
  openInPreview?: boolean,
  forceDiskSerialization?: boolean,
): Promise<void> {
  if (
    !(forceDiskSerialization ?? false) &&
    valueOrEval(viewable.supportsImageViewer) &&
    getConfiguration("useExperimentalViewer", undefined, false) === true
  ) {
    const response = await serializeImageUsingSocketServer(
      obj,
      viewable,
      session,
    );
    if (response.err) {
      logWarn(response.val);
      return viewObject(obj, viewable, session, path, openInPreview, true);
    } else {
      const webviewClient = Container.get(GlobalWebviewClient);
      await webviewClient.reveal();
      webviewClient.sendRequest(
        WebviewRequests.showImage(response.safeUnwrap()),
      );
    }
  } else {
    const resPath = await serializePythonObjectToDisk(
      obj,
      viewable,
      session,
      path,
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
  const session = vscode.debug.activeDebugSession;
  const document = vscode.window.activeTextEditor?.document;
  const range = vscode.window.activeTextEditor?.selection;
  if (session === undefined || document === undefined || range === undefined) {
    return undefined;
  }

  const userSelection = currentUserSelection(document, range);
  if (userSelection === undefined) {
    return;
  }

  const objectViewables = await findExpressionViewables(
    selectionString(userSelection),
    debugSession(session),
  );
  if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
    return undefined;
  }

  return viewObject(
    userSelection,
    objectViewables.safeUnwrap()[0],
    debugSession(session),
  );
}

export async function trackObjectUnderCursor(): Promise<unknown> {
  const session = vscode.debug.activeDebugSession;
  const document = vscode.window.activeTextEditor?.document;
  const range = vscode.window.activeTextEditor?.selection;
  if (session === undefined || document === undefined || range === undefined) {
    return undefined;
  }

  const userSelection = currentUserSelection(document, range);
  if (userSelection === undefined) {
    return;
  }
  const userSelectionAsString = selectionString(userSelection);

  // find if it is an existing expression in the list
  const debugSessionData = activeDebugSessionData(session);
  const objectInList = debugSessionData.currentPythonObjectsList.find(
    userSelectionAsString,
  );

  const objectViewables = await findExpressionViewables(
    userSelectionAsString,
    debugSession(session),
  );

  // add as expression if not found
  if (objectInList === undefined) {
    await debugSessionData.currentPythonObjectsList.addExpression(
      userSelectionAsString,
    );
  }
  let savePath: string | undefined = undefined;
  if (objectViewables.ok && objectViewables.safeUnwrap().length > 0) {
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
      objectViewables.safeUnwrap()[0],
      savePath,
      trackingId,
    );
  }

  Container.get(WatchTreeProvider).refresh();

  if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
    return undefined;
  }

  return viewObject(
    userSelection,
    objectViewables.safeUnwrap()[0],
    debugSession(session),
    savePath,
    false,
  );
}
