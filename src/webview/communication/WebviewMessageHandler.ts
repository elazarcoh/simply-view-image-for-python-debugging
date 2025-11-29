import type { Session } from '../../session/Session';
import type {
  EditExpression,
  FromWebviewMessageWithId,
  MessageId,
  RequestBatchItemData,
  RequestImageData,
  SaveImage,
} from '../webview';
import type { WebviewCommunication } from './WebviewClient';
import * as path from 'node:path';
import Container from 'typedi';
import * as vscode from 'vscode';
import { ExtensionPersistentState } from '../../ExtensionPersistentState';
import { serializeImageUsingSocketServer } from '../../from-python-serialization/SocketSerialization';
import {
  addExpression,
  editExpression,
} from '../../image-watch-tree/PythonObjectsList';
import { WatchTreeProvider } from '../../image-watch-tree/WatchTreeProvider';
import { logDebug, logError, logTrace } from '../../Logging';
import { findExpressionViewables } from '../../PythonObjectInfo';
import { activeDebugSessionData } from '../../session/debugger/DebugSessionsHolder';
import { maybeDebugSession } from '../../session/Session';
import { getSessionData } from '../../session/SessionData';
import { Option } from '../../utils/Option';
import { errorMessage } from '../../utils/Result';
import { disposeAll } from '../../utils/VSCodeUtils';
import { WebviewRequests, WebviewResponses } from './createMessages';
import { saveImageToFile } from './saveImage';

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
    const objectItemKind
      = currentPythonObjectsList.find(args.expression)?.type ?? 'expression';

    const objectViewables = await findExpressionViewables(
      args.expression,
      session,
    );

    if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
      return undefined;
    }

    const response = await serializeImageUsingSocketServer(
      objectItemKind === 'variable'
        ? { variable: args.expression }
        : { expression: args.expression },
      objectViewables.safeUnwrap()[0],
      session,
    );
    if (response.err) {
      logError('Error retrieving image using socket', errorMessage(response));
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
    const objectItemKind
      = currentPythonObjectsList.find(args.expression)?.type ?? 'expression';

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
      objectItemKind === 'variable'
        ? { variable: args.expression }
        : { expression: args.expression },
      objectViewables.safeUnwrap()[0],
      session,
      { start, stop },
    );
    if (response.err) {
      logError('Error retrieving image using socket', errorMessage(response));
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

  async handleSaveImage(_id: MessageId, { expression }: SaveImage) {
    const maybeSession = this.thisSession;
    if (maybeSession.none) {
      vscode.window.showErrorMessage('No active debug session');
      return;
    }
    const session = maybeSession.val;
    const sessionData = getSessionData(session);
    if (sessionData === undefined) {
      vscode.window.showErrorMessage('No session data available');
      return;
    }

    const currentPythonObjectsList = sessionData.currentPythonObjectsList;
    const objectItemKind
      = currentPythonObjectsList.find(expression)?.type ?? 'expression';

    const objectViewables = await findExpressionViewables(expression, session);

    if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
      vscode.window.showErrorMessage(
        `Cannot find viewable for expression: ${expression}`,
      );
      return;
    }

    const response = await serializeImageUsingSocketServer(
      objectItemKind === 'variable'
        ? { variable: expression }
        : { expression },
      objectViewables.safeUnwrap()[0],
      session,
    );

    if (response.err) {
      logError('Error retrieving image for save', errorMessage(response));
      vscode.window.showErrorMessage('Failed to retrieve image data');
      return;
    }

    const imageMessage = response.safeUnwrap();

    // Get last save directory from persistent state
    const persistentState = Container.get(ExtensionPersistentState);
    const lastSaveDir
      = persistentState.workspace.get<string>('lastSaveImageDir')
        ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        ?? '';

    // Sanitize the expression to create a valid filename
    const sanitizedName = expression.replace(/[<>:"/\\|?*]/g, '_');
    const defaultFilename = `${sanitizedName}.png`;
    const defaultPath = path.join(lastSaveDir, defaultFilename);

    // Show save dialog
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultPath),
      filters: { Images: ['png'] },
      title: 'Save Image',
    });

    if (saveUri === undefined) {
      return; // User cancelled
    }

    // Save the last directory
    const saveDir = path.dirname(saveUri.fsPath);
    await persistentState.workspace.update('lastSaveImageDir', saveDir);

    // Save the image
    try {
      await saveImageToFile(imageMessage, saveUri.fsPath);
      logDebug(`Image saved to ${saveUri.fsPath}`);
      const filename = path.basename(saveUri.fsPath);
      vscode.window.showInformationMessage(`Image saved: ${filename}`);
    }
    catch (error) {
      logError('Error saving image', error);
      vscode.window.showErrorMessage(
        `Failed to save image: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onWebviewMessage(messageWithId: FromWebviewMessageWithId) {
    logTrace('Received message from webview', messageWithId);

    const { id, message } = messageWithId;

    const type = message.type;
    logTrace('Received message type', type);
    switch (type) {
      case 'WebviewReady':
        return this.handleWebviewReady(id);
      case 'RequestImages':
        return this.handleImagesRequest(id);
      case 'RequestBatchItemData':
        return this.handleBatchItemDataRequest(id, message);
      case 'RequestImageData':
        return this.handleImageDataRequest(id, message);
      case 'AddExpression':
        return this.handleAddExpression(id);
      case 'EditExpression':
        return this.handleEditExpression(id, message);
      case 'SaveImage':
        return this.handleSaveImage(id, message);

      default:
        ((_: never) => {
          throw new Error(`Unknown message type: ${type}`);
        })(type);
    }
  }
}
