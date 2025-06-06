import * as vscode from "vscode";
import {
  EditExpression,
  FromWebviewMessageWithId,
  MessageId,
  RequestBatchItemData,
  RequestImageData,
} from "../webview";
import { findExpressionViewables } from "../../PythonObjectInfo";
import { logError, logTrace } from "../../Logging";
import { serializeImageUsingSocketServer } from "../../from-python-serialization/SocketSerialization";
import Container from "typedi";
import { WebviewCommunication } from "./WebviewClient";
import { WebviewRequests, WebviewResponses } from "./createMessages";
import { errorMessage } from "../../utils/Result";
import { activeDebugSessionData } from "../../debugger-utils/DebugSessionsHolder";
import {
  addExpression,
  editExpression,
} from "../../image-watch-tree/PythonObjectsList";
import { WatchTreeProvider } from "../../image-watch-tree/WatchTreeProvider";
import { disposeAll } from "../../utils/VSCodeUtils";

export class WebviewMessageHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(readonly webviewCommunication: WebviewCommunication) {
    // Set an event listener to listen for messages passed from the webview context
    this.webviewCommunication.webview.onDidReceiveMessage(
      this.onWebviewMessage,
      this,
      this._disposables,
    );
  }

  dispose() {
    disposeAll(this._disposables);
  }

  handleImagesRequest(id: MessageId) {
    this.webviewCommunication.sendResponse(
      id,
      WebviewResponses.imagesObjects(),
    );
  }

  async handleImageDataRequest(id: MessageId, args: RequestImageData) {
    const debugSession = vscode.debug.activeDebugSession;
    if (debugSession === undefined) {
      return undefined;
    }

    const currentPythonObjectsList =
      activeDebugSessionData(debugSession)?.currentPythonObjectsList;
    const objectItemKind =
      currentPythonObjectsList.find(args.expression)?.type ?? "expression";

    const objectViewables = await findExpressionViewables(
      args.expression,
      debugSession,
    );

    if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
      return undefined;
    }

    const response = await serializeImageUsingSocketServer(
      objectItemKind === "variable"
        ? { variable: args.expression }
        : { expression: args.expression },
      objectViewables.safeUnwrap()[0],
      debugSession,
    );
    if (response.err) {
      logError("Error retrieving image using socket", errorMessage(response));
      return undefined;
    }

    this.webviewCommunication.sendResponse(
      id,
      WebviewResponses.imageData(response.safeUnwrap()),
    );
  }

  async handleBatchItemDataRequest(id: string, args: RequestBatchItemData) {
    const debugSession = vscode.debug.activeDebugSession;
    if (debugSession === undefined) {
      return undefined;
    }

    const currentPythonObjectsList =
      activeDebugSessionData(debugSession)?.currentPythonObjectsList;
    const objectItemKind =
      currentPythonObjectsList.find(args.expression)?.type ?? "expression";

    const objectViewables = await findExpressionViewables(
      args.expression,
      debugSession,
    );

    if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
      return undefined;
    }

    const start = Math.max(args.batch_item - 1, 0);
    const stop = Math.max(args.batch_item + 1, 0);

    const response = await serializeImageUsingSocketServer(
      objectItemKind === "variable"
        ? { variable: args.expression }
        : { expression: args.expression },
      objectViewables.safeUnwrap()[0],
      debugSession,
      { start, stop },
    );
    if (response.err) {
      logError("Error retrieving image using socket", errorMessage(response));
      return undefined;
    }

    this.webviewCommunication.sendResponse(
      id,
      WebviewResponses.imageData(response.safeUnwrap()),
    );
  }

  async handleWebviewReady(id: MessageId) {
    this.webviewCommunication.setReady();
    this.webviewCommunication.sendRequest(WebviewRequests.configuration());
    this.webviewCommunication.sendResponse(
      id,
      WebviewResponses.imagesObjects(),
    );
  }

  async handleAddExpression(id: MessageId) {
    const added = await addExpression();
    if (added) {
      await activeDebugSessionData()?.currentPythonObjectsList.update();
      Container.get(WatchTreeProvider).refresh();
      this.webviewCommunication.sendResponse(
        id,
        WebviewResponses.imagesObjects(),
      );
    }
  }

  async handleEditExpression(id: MessageId, { expression }: EditExpression) {
    const changed = await editExpression(expression);
    if (changed) {
      await activeDebugSessionData()?.currentPythonObjectsList.update();
      Container.get(WatchTreeProvider).refresh();
      this.webviewCommunication.sendResponse(
        id,
        WebviewResponses.imagesObjects(),
      );
    }
  }

  async onWebviewMessage(messageWithId: FromWebviewMessageWithId) {
    logTrace("Received message from webview", messageWithId);

    const { id, message } = messageWithId;

    const type = message.type;
    logTrace("Received message type", type);
    switch (type) {
      case "WebviewReady":
        return this.handleWebviewReady(id);
      case "RequestImages":
        return this.handleImagesRequest(id);
      case "RequestBatchItemData":
        return this.handleBatchItemDataRequest(id, message);
      case "RequestImageData":
        return this.handleImageDataRequest(id, message);
      case "AddExpression":
        return this.handleAddExpression(id);
      case "EditExpression":
        return this.handleEditExpression(id, message);

      default:
        ((_: never) => {
          throw new Error(`Unknown message type: ${type}`);
        })(type);
    }
  }
}
