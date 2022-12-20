import * as vscode from "vscode";
import {
    AddExpressionWatchTreeItem,
    ExpressionWatchTreeItem,
} from "./WatchExpression";
import Container, { Service } from "typedi";
import { VariableWatchTreeItem } from "./WatchVariable";
import {
    PythonObjectInfoLineTreeItem,
    PythonObjectTreeItem,
} from "./WatchTreeItem";
import { DebugSessionsHolder } from "../debugger-utils/DebugSessionsHolder";
import { Viewable } from "../viewable/Viewable";

type TreeItem =
    | VariableWatchTreeItem
    | ExpressionWatchTreeItem
    | typeof AddExpressionWatchTreeItem
    | PythonObjectInfoLineTreeItem;

@Service() // This is a service, the actual items are retrieved using the DebugSessionData
export class WatchTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<
        TreeItem | undefined
    >();

    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(
        element: TreeItem
    ): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        const debugSession = vscode.debug.activeDebugSession;
        if (debugSession === undefined) {
            return [];
        }
        if (element === undefined) {
            // root
            const debugSessionData =
                Container.get(DebugSessionsHolder).debugSessionData(
                    debugSession
                );
            // debugSessionData.currentPythonObjectsList.variablesList.map(
            //                     (e) => toTreeItem(e, VariableWatchTreeItem)
            //                 )
            return [
                // ...,
                // ...debugSessionData.currentPythonObjectsList.expressionsList.map(toTreeItem),
                AddExpressionWatchTreeItem,
            ];
        } else if (element instanceof VariableWatchTreeItem) {
            return [] as PythonObjectInfoLineTreeItem[];
        } else if (element instanceof ExpressionWatchTreeItem) {
            return [] as PythonObjectInfoLineTreeItem[];
        } else if (element === AddExpressionWatchTreeItem) {
            return [];
        } else {
            return [];
        }
    }
}
