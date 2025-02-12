import * as vscode from "vscode";
import { FromWebviewMessageWithId, MessageId } from "../webview";
import { logTrace } from "../../Logging";
import { WebviewCommunication } from "./WebviewClient";
import { WebviewRequests } from "./createMessages";
import { disposeAll } from "../../utils/VSCodeUtils";

export class SingleImageModeWebviewMessageHandler implements vscode.Disposable {
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

  private async handleWebviewReady(id: MessageId) {
    this.webviewCommunication.setReady();
    this.webviewCommunication.sendRequest(WebviewRequests.configuration());
    this.webviewCommunication.sendRequest(
      WebviewRequests.setMode("single-image"),
    );
  }

  private async onWebviewMessage(messageWithId: FromWebviewMessageWithId) {
    logTrace("Received message from webview", messageWithId);

    const { id, message } = messageWithId;

    const type = message.type;
    logTrace("Received message type", type);
    switch (type) {
      case "WebviewReady":
        return this.handleWebviewReady(id);
      // not need to handle these messages in single image mode
      case "RequestImages":
      case "RequestBatchItemData":
      case "RequestImageData":
      case "AddExpression":
      case "EditExpression":
        return;

      default:
        ((_: never) => {
          throw new Error(`Unknown message type: ${type}`);
        })(type);
    }
  }
}
