import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { PythonObjectTreeItem } from "./WatchTreeItem";

// singleton object that used to add expression when user click on it
class _AddExpressionWatchTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string = "Add Expression",
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
    }

    readonly command: vscode.Command = {
        command: `svifpd.add-expression`,
        title: "Add Expression",
        tooltip: "Add Expression",
    };
}
export const AddExpressionWatchTreeItem = new _AddExpressionWatchTreeItem();

export class ExpressionWatchTreeItem extends PythonObjectTreeItem {
    constructor(
        public readonly expression: string,
        viewables: Readonly<NonEmptyArray<Viewable>>,
        info: Readonly<PythonObjectInformation>,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.Collapsed
    ) {
        super(
            "expression",
            expression,
            expression,
            viewables,
            info,
            false,
            collapsibleState
        );
        this.updateContext();
    }
}
