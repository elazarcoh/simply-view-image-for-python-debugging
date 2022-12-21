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
import {
    activeDebugSessionData,
    DebugSessionsHolder,
} from "../debugger-utils/DebugSessionsHolder";
import { globalExpressionsList, InfoOrError } from "./PythonObjectsList";
import { Except } from "../utils/Except";
import { zip } from "../utils/Utils";

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

    refresh(item?: TreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    getTreeItem(
        element: TreeItem
    ): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (element === undefined) {
            // root
            const debugSessionData = activeDebugSessionData();
            const variableItems =
                debugSessionData?.currentPythonObjectsList.variablesList.map(
                    ([exp, info]) =>
                        info.isError
                            ? new ErrorWatchTreeItem(exp, info.error)
                            : new VariableWatchTreeItem(
                                  exp,
                                  info.result[0],
                                  info.result[1]
                              )
                ) ?? [];
            const expressionsInfoOrNotReady: InfoOrError[] =
                debugSessionData?.currentPythonObjectsList.expressionsInfo ??
                Array(globalExpressionsList.length).fill(
                    Except.error("Not ready") as InfoOrError
                );

            const expressionsItems = zip(
                globalExpressionsList,
                expressionsInfoOrNotReady
            ).map(([exp, info]) =>
                info.isError
                    ? new ErrorWatchTreeItem(exp, info.error)
                    : new ExpressionWatchTreeItem(
                          exp,
                          info.result[0],
                          info.result[1]
                      )
            );

            // Set the tracking state if was tracked before
            const trackedPythonObjects =
                activeDebugSessionData()?.trackedPythonObjects;
            if (trackedPythonObjects !== undefined) {
                for (const item of variableItems.concat(expressionsItems)) {
                    const maybeTrackingId =
                        trackedPythonObjects.trackingIdIfTracked({
                            expression: item.expression,
                        });
                    if (maybeTrackingId !== undefined) {
                        item.setTracked(maybeTrackingId);
                    }
                }
            }

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
