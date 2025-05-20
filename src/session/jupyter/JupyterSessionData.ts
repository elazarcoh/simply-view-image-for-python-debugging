import * as vscode from "vscode";
import { SavePathHelper } from "../../SerializationHelper";
import _ from "lodash";
import { SessionData } from "../SessionData";
import { CurrentPythonObjectsListData } from "../../image-watch-tree/PythonObjectsList";
import { JupyterHandler } from "./jupyterHandler";
import { Kernel } from "@vscode/jupyter-extension";

export class JupyterSessionData implements SessionData {
  public readonly savePathHelper: SavePathHelper;
  public setupOkay: boolean = false;
  public isValid: boolean = true;
  public readonly currentPythonObjectsList: CurrentPythonObjectsListData;
  public readonly jupyterHandler: JupyterHandler;
  public documentUri: vscode.Uri | undefined = undefined;

  constructor(
    private readonly notebookUri: vscode.Uri,
    private readonly kernel: Kernel,
  ) {
    this.savePathHelper = new SavePathHelper(_.uniqueId("jupyter-session-"));
    this.currentPythonObjectsList = new CurrentPythonObjectsListData();
    this.jupyterHandler = new JupyterHandler(this.kernel);
  }

  dispose(): void {
    this.jupyterHandler.dispose();
  }
}

export function isJupyterSessionData(
  data: SessionData,
): data is JupyterSessionData {
  return data instanceof JupyterSessionData;
}
