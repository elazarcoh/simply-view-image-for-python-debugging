import { Kernel } from "@vscode/jupyter-extension";
import _ from "lodash";
import Container from "typedi";
import * as vscode from "vscode";
import { CurrentPythonObjectsListData } from "../../image-watch-tree/PythonObjectsList";
import { SavePathHelper } from "../../SerializationHelper";
import {
  WebviewClient,
  WebviewClientFactory,
} from "../../webview/communication/WebviewClient";
import { SessionData } from "../SessionData";
import { JupyterHandler } from "./jupyterHandler";
import { JupyterSession } from "../Session";

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
    this.savePathHelper = new SavePathHelper(_.uniqueId("jupyter-session-"));
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
