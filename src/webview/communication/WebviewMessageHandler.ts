import type { Session } from '../../session/Session';
import type {
  EditExpression,
  FromWebviewMessageWithId,
  MessageId,
  RequestBatchItemData,
  RequestImageData,
} from '../webview';
import type { WebviewCommunication } from './WebviewClient';
import Container from 'typedi';
import * as vscode from 'vscode';
import { serializeImageUsingSocketServer } from '../../from-python-serialization/SocketSerialization';
import {
  addExpression,
  editExpression,
} from '../../image-watch-tree/PythonObjectsList';
import { WatchTreeProvider } from '../../image-watch-tree/WatchTreeProvider';
import { logError, logTrace } from '../../Logging';
import { findExpressionViewables } from '../../PythonObjectInfo';
import { activeDebugSessionData } from '../../session/debugger/DebugSessionsHolder';
import { maybeDebugSession } from '../../session/Session';
import { getSessionData } from '../../session/SessionData';
import { Option } from '../../utils/Option';
import { errorMessage } from '../../utils/Result';
import { disposeAll } from '../../utils/VSCodeUtils';
import { WebviewRequests, WebviewResponses } from './createMessages';

// Define SaveImage type for now until Rust codegen is fixed
interface SaveImage {
  image_id: { session_id: string; id: string };
  expression: string;
}

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

  async handleSaveImage(id: MessageId, { image_id, expression }: SaveImage) {
    const maybeSession = this.thisSession;
    if (maybeSession.none) {
      return;
    }
    const session = maybeSession.val;

    // Only support debug sessions for now
    if (session.type !== 'debug') {
      logError('Save image is only supported for debug sessions');
      return;
    }

    const debugSessionData = activeDebugSessionData();
    if (!debugSessionData || debugSessionData.setupOkay === false) {
      logError('Cannot save image: debug session not ready');
      return;
    }

    // Create a TrackedObject with the current image information
    const trackedObject = {
      expression: { expression },
      viewable: await this.getViewableForExpression(expression, session),
      savePath: debugSessionData.savePathHelper.savePathFor({ expression }),
    };

    if (trackedObject.viewable) {
      // Use the existing saveAllTrackedObjects functionality
      await this.saveTrackedObject(trackedObject, session.session);
      logTrace('Image saved successfully for expression:', expression);
    }
    else {
      logError('Could not find viewable for expression:', expression);
    }
  }

  private async getViewableForExpression(expression: string, session: any) {
    const objectViewables = await findExpressionViewables(expression, session);
    if (objectViewables.err || objectViewables.safeUnwrap().length === 0) {
      return null;
    }
    return objectViewables.safeUnwrap()[0];
  }

  private async saveTrackedObject(trackedObject: any, session: vscode.DebugSession) {
    try {
      // Import saveAllTrackedObjects here to avoid circular dependencies
      const { saveAllTrackedObjects } = await import('../../image-watch-tree/TrackedPythonObjects');
      await saveAllTrackedObjects([trackedObject], session);
      logTrace('Image saved successfully');
    }
    catch (error) {
      logError('Failed to save image:', error);
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
        return this.handleSaveImage(id, message as any);

      default:
        // Use a more defensive approach for unknown message types
        logError(`Unknown message type: ${type}`);
    }
  }
}
