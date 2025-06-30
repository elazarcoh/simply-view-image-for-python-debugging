import Container from "typedi";
import * as vscode from "vscode";
import { logError, logTrace } from "../../Logging";
import { findExpressionViewables } from "../../PythonObjectInfo";
import { serializeImageUsingSocketServer } from "../../from-python-serialization/SocketSerialization";
import {
  addExpression,
  editExpression,
} from "../../image-watch-tree/PythonObjectsList";
import { WatchTreeProvider } from "../../image-watch-tree/WatchTreeProvider";
import { maybeDebugSession, Session } from "../../session/Session";
import { getSessionData } from "../../session/SessionData";
import { activeDebugSessionData } from "../../session/debugger/DebugSessionsHolder";
import { Option } from "../../utils/Option";
import { errorMessage } from "../../utils/Result";
import { disposeAll } from "../../utils/VSCodeUtils";
import {
  EditExpression,
  FromWebviewMessageWithId,
  MessageId,
  RequestBatchItemData,
  RequestImageData,
} from "../webview";
import { WebviewCommunication } from "./WebviewClient";
import { WebviewRequests, WebviewResponses } from "./createMessages";

export class WebviewMessageHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    readonly webviewCommunication: WebviewCommunication,
    readonly session: Option<Session>,
  ) {
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

  get thisSession(): Option<Session> {
    return Option.or(
      this.session,
      maybeDebugSession(vscode.debug.activeDebugSession),
    );
  }

  handleImagesRequest(id: MessageId) {
    this.webviewCommunication.sendResponse(
      id,
      WebviewResponses.imagesObjects(this.thisSession),
    );
  }

  async handleImageDataRequest(id: MessageId, args: RequestImageData) {
    const maybeSession = this.thisSession;
    if (maybeSession.none) {
      return;
    }
    const session = maybeSession.val;
    const sessionData = getSessionData(session);
    if (sessionData === undefined) {
      return;
    }
    const currentPythonObjectsList = sessionData.currentPythonObjectsList;
    const objectItemKind =
      currentPythonObjectsList.find(args.expression)?.type ?? "expression";

    const objectViewables = await findExpressionViewables(
      args.expression,
      session,
    );

    if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
      return undefined;
    }

    const response = await serializeImageUsingSocketServer(
      objectItemKind === "variable"
        ? { variable: args.expression }
        : { expression: args.expression },
      objectViewables.safeUnwrap()[0],
      session,
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
    const maybeSession = this.thisSession;
    if (maybeSession.none) {
      return;
    }
    const session = maybeSession.val;
    const sessionData = getSessionData(session);
    if (sessionData === undefined) {
      return;
    }

    const currentPythonObjectsList = sessionData.currentPythonObjectsList;
    const objectItemKind =
      currentPythonObjectsList.find(args.expression)?.type ?? "expression";

    const objectViewables = await findExpressionViewables(
      args.expression,
      session,
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
      session,
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
    this.webviewCommunication.setReady(true);
    this.webviewCommunication.sendRequest(WebviewRequests.configuration());
    this.webviewCommunication.sendResponse(
      id,
      WebviewResponses.imagesObjects(this.thisSession),
    );
  }

  async handleAddExpression(id: MessageId) {
    const added = await addExpression();
    if (added) {
      await activeDebugSessionData()?.currentPythonObjectsList.update();
      Container.get(WatchTreeProvider).refresh();
      this.webviewCommunication.sendResponse(
        id,
        WebviewResponses.imagesObjects(this.thisSession),
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
        WebviewResponses.imagesObjects(this.thisSession),
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
