import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { PythonObjectTreeItem } from "./WatchTreeItem";

export class VariableWatchTreeItem extends PythonObjectTreeItem {
    constructor(
        public readonly variableName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.Collapsed,
        viewables: Viewable[]
    ) {
        super("variable", variableName, collapsibleState, viewables);
        this.updateContext();
    }
}
