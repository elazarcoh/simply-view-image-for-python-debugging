import type { Result } from '../../utils/Result';
import type {
  FromWebviewMessageWithId,
  ImageMessage,
  MessageId,
  RequestImageData,
} from '../webview';
import type { WebviewCommunication } from './WebviewClient';
import * as vscode from 'vscode';
import { logTrace } from '../../Logging';
import { errorMessage } from '../../utils/Result';
import { disposeAll } from '../../utils/VSCodeUtils';
import { WebviewRequests, WebviewResponses } from './createMessages';

export class SingleImageModeWebviewMessageHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    readonly webviewCommunication: WebviewCommunication,
    private readonly getData: (
      args: RequestImageData,
    ) => Promise<Result<ImageMessage>>,
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

  private async handleWebviewReady(_id: MessageId) {
    this.webviewCommunication.setReady(true);
    this.webviewCommunication.sendRequest(WebviewRequests.configuration());
    this.webviewCommunication.sendRequest(
      WebviewRequests.setMode('single-image'),
    );
  }

  async handleImageDataRequest(id: MessageId, args: RequestImageData) {
    const imageMessage = await this.getData(args);
    if (imageMessage.ok) {
      this.webviewCommunication.sendResponse(
        id,
        WebviewResponses.imageData(imageMessage.safeUnwrap()),
      );
    }
    else {
      // TODO: show error message in webview
      vscode.window.showErrorMessage(errorMessage(imageMessage));
    }
  }

  private async onWebviewMessage(messageWithId: FromWebviewMessageWithId) {
    logTrace('Received message from webview', messageWithId);

    const { id, message } = messageWithId;

    const type = message.type;
    logTrace('Received message type', type);
    switch (type) {
      case 'WebviewReady':
        return this.handleWebviewReady(id);
      case 'RequestImageData':
        return this.handleImageDataRequest(id, message);
      // not need to handle these messages in single image mode
      case 'RequestImages':
      case 'RequestBatchItemData':
      case 'AddExpression':
      case 'EditExpression':
      case 'SaveImage':
        return;

      default:
        ((_: never) => {
          throw new Error(`Unknown message type: ${type}`);
        })(type);
    }
  }
}
