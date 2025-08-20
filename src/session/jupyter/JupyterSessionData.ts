import type { Kernel } from '@vscode/jupyter-extension';
import type * as vscode from 'vscode';
import type {
  WebviewClient,
} from '../../webview/communication/WebviewClient';
import type { JupyterSession } from '../Session';
import type { SessionData } from '../SessionData';
import _ from 'lodash';
import Container from 'typedi';
import { CurrentPythonObjectsListData } from '../../image-watch-tree/PythonObjectsList';
import { SavePathHelper } from '../../SerializationHelper';
import {
  WebviewClientFactory,
} from '../../webview/communication/WebviewClient';
import { JupyterHandler } from './jupyterHandler';

export class JupyterSessionData implements SessionData {
  public readonly savePathHelper: SavePathHelper;
  public setupOkay: boolean = false;
  public isIdle: boolean = false;
  public isValid: boolean = true;
  public readonly currentPythonObjectsList: CurrentPythonObjectsListData;
  public readonly jupyterHandler: JupyterHandler;
  public documentUri: vscode.Uri | undefined = undefined;
  public readonly webviewClient: WebviewClient;

  constructor(
    public readonly session: JupyterSession,
    public readonly notebookUri: vscode.Uri,
    public readonly kernel: Kernel,
  ) {
    this.savePathHelper = new SavePathHelper(_.uniqueId('jupyter-session-'));
    this.currentPythonObjectsList = new CurrentPythonObjectsListData();
    this.jupyterHandler = new JupyterHandler(this.kernel);
    this.webviewClient = Container.get(WebviewClientFactory).create(session);
  }

  dispose(): void {
    this.jupyterHandler.dispose();
  }

  get canExecute(): boolean {
    return this.isValid && this.isIdle;
  }
}

export function isJupyterSessionData(
  data: SessionData,
): data is JupyterSessionData {
  return data instanceof JupyterSessionData;
}
