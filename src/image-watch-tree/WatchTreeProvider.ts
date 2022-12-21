import * as vscode from "vscode";
import {
    AddExpressionWatchTreeItem,
    ExpressionWatchTreeItem,
} from "./WatchExpression";
import Container, { Service } from "typedi";
import { VariableWatchTreeItem } from "./WatchVariable";
import {
    ErrorWatchTreeItem,
    PythonObjectInfoLineTreeItem,
    PythonObjectTreeItem,
} from "./WatchTreeItem";
import { DebugSessionsHolder } from "../debugger-utils/DebugSessionsHolder";
import { expressionsList } from "./PythonObjectsList";

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
            const variableItems =
                debugSessionData.currentPythonObjectsList.variablesList.map(
                    ([exp, info]) =>
                        info.isError
                            ? new ErrorWatchTreeItem(exp, info.error)
                            : new VariableWatchTreeItem(
                                  exp,
                                  info.result[0],
                                  info.result[1]
                              )
                );
            const expressionsItems = expressionsList.map(([exp, info]) =>
                info.isError
                    ? new ErrorWatchTreeItem(exp, info.error)
                    : new ExpressionWatchTreeItem(
                          exp,
                          info.result[0],
                          info.result[1]
                      )
            );

            return [
                ...variableItems,
                ...expressionsItems,
                AddExpressionWatchTreeItem,
            ];
        } else if (element instanceof PythonObjectTreeItem) {
            const infoItems = Object.entries(element.info).map(
                ([name, value]) => new PythonObjectInfoLineTreeItem(name, value)
            );
            return infoItems;
        } else if (element === AddExpressionWatchTreeItem) {
            return [];
        } else {
            return [];
        }
    }
}
