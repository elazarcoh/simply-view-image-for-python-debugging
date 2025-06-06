import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { PythonObjectTreeItem } from "./WatchTreeItem";

export class VariableWatchTreeItem extends PythonObjectTreeItem {
  constructor(
    public readonly variableName: string,
    viewables: Readonly<NonEmptyArray<Viewable>>,
    info: Readonly<PythonObjectInformation>,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Collapsed,
  ) {
    super(
      "variable",
      variableName,
      variableName,
      viewables,
      info,
      collapsibleState,
    );
    this.updateContext();
  }
}
