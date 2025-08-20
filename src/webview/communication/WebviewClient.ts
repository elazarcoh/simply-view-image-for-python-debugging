import type { Session } from '../../session/Session';
import type {
  ExtensionRequest,
  ExtensionResponse,
  FromExtensionMessageWithId,
  MessageId,
} from '../webview';
import { None, Option } from 'ts-results';
import { Inject, Service } from 'typedi';
import * as vscode from 'vscode';
import { logTrace } from '../../Logging';
import { disposeAll } from '../../utils/VSCodeUtils';
import { ImageViewPanel } from '../panels/ImageViewPanel';
import { WebviewMessageHandler } from './WebviewMessageHandler';

export class WebviewCommunication {
  private _isReady = false;

  constructor(public readonly webview: vscode.Webview) {}

  setReady(ready: boolean) {
    this._isReady = ready;
  }

  get isReady() {
    return this._isReady;
  }

  async waitForReady(maxTries: number = 100) {
    const indefinite = maxTries < 0;
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!this.isReady && (maxTries > 0 || indefinite)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      maxTries--;
    }
  }

  static randomMessageId(): MessageId {
    return Math.random().toString(36).substring(2, 15);
  }

  private sendToWebview(message: FromExtensionMessageWithId) {
    if (this.webview === undefined) {
      return;
    }
    logTrace(`message: ${JSON.stringify(message)}`);
    return this.webview.postMessage(message);
  }

  sendRequest(message: ExtensionRequest) {
    const id = GlobalWebviewClient.randomMessageId();
    const messageWithId: FromExtensionMessageWithId = {
      id,
      message: { kind: 'Request', ...message },
    };
    this.sendToWebview(messageWithId);
  }

  sendResponse(id: MessageId, message: ExtensionResponse) {
    const messageWithId: FromExtensionMessageWithId = {
      id,
      message: { kind: 'Response', ...message },
    };
    this.sendToWebview(messageWithId);
  }
}

class WebviewClient implements vscode.Disposable {
  private readonly context: vscode.ExtensionContext;

  private _currentPanel: vscode.WebviewPanel | undefined;
  private _webviewMessageHandler: WebviewMessageHandler | undefined;

  private _disposables: vscode.Disposable[] = [];

  constructor(
    @Inject('vscode.ExtensionContext') context: vscode.ExtensionContext,
    public readonly session: Option<Session>,
  ) {
    this.context = context;
  }

  static randomMessageId(): MessageId {
    return Math.random().toString(36).substring(2, 15);
  }

  async reveal() {
    if (!this._currentPanel) {
      this._currentPanel = vscode.window.createWebviewPanel(
        'image-view',
        'Image View',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
          ],
        },
      );
      this._disposables.push(
        this._currentPanel.onDidChangeViewState((e) => {
          if (!e.webviewPanel.visible) {
            this._webviewMessageHandler?.webviewCommunication.setReady(false);
          }
        }),
      );
      this._disposables.push(this._currentPanel);
      const webviewCommunication = new WebviewCommunication(
        this._currentPanel.webview,
      );
      this._webviewMessageHandler = new WebviewMessageHandler(
        webviewCommunication,
        this.session,
      );

      this._currentPanel.onDidDispose(
        () => this.dispose(),
        null,
        this._disposables,
      );

      ImageViewPanel.render(this.context, this._currentPanel);
    }

    if (!this._currentPanel.visible) {
      this._currentPanel.reveal(this._currentPanel.viewColumn);
    }

    // wait for the webview to be ready
    await this._webviewMessageHandler?.webviewCommunication.waitForReady();
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    // Dispose of the current webview panel
    disposeAll(this._disposables);
    this._currentPanel = undefined;
    this._webviewMessageHandler = undefined;
  }

  sendRequest(message: ExtensionRequest) {
    this._webviewMessageHandler?.webviewCommunication.sendRequest(message);
  }

  sendResponse(id: MessageId, message: ExtensionResponse) {
    this._webviewMessageHandler?.webviewCommunication.sendResponse(id, message);
  }
}

export type { WebviewClient };

@Service()
export class WebviewClientFactory {
  constructor(
    @Inject('vscode.ExtensionContext')
    private readonly context: vscode.ExtensionContext,
  ) {}

  public create(session: Session | undefined): WebviewClient {
    return new WebviewClient(this.context, Option.wrap(session));
  }
}

@Service()
export class GlobalWebviewClient extends WebviewClient {
  constructor(
    @Inject('vscode.ExtensionContext')
    context: vscode.ExtensionContext,
  ) {
    super(
      context,
      None, // Global webview client does not have a specific session
    );
  }
}
