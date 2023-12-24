import * as vscode from "vscode";
import {
    AddExpressionWatchTreeItem,
    ExpressionWatchTreeItem,
} from "./WatchExpression";
import { Service } from "typedi";
import { VariableWatchTreeItem } from "./WatchVariable";
import {
    ErrorWatchTreeItem,
    PythonObjectInfoLineTreeItem,
    PythonObjectTreeItem,
} from "./WatchTreeItem";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { globalExpressionsList, InfoOrError } from "./PythonObjectsList";
import { isOf, zip } from "../utils/Utils";
import { Err, errorMessage } from "../utils/Result";

class ItemsRootTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly items: TreeItem[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.Expanded
    ) {
        super(label, collapsibleState);
    }
}

type TreeItem =
    | VariableWatchTreeItem
    | ExpressionWatchTreeItem
    | ErrorWatchTreeItem
    | typeof AddExpressionWatchTreeItem
    | PythonObjectInfoLineTreeItem
    | ItemsRootTreeItem;

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
                        info.err
                            ? new ErrorWatchTreeItem(
                                  exp,
                                  errorMessage(info),
                                  "variable"
                              )
                            : new VariableWatchTreeItem(
                                  exp,
                                  info.safeUnwrap()[0],
                                  info.safeUnwrap()[1]
                              )
                ) ?? [];

            const expressionsInfoOrNotReady =
                debugSessionData?.currentPythonObjectsList.expressionsInfo ??
                (Array(globalExpressionsList.length).fill(
                    Err("Not ready") as InfoOrError
                ) as InfoOrError[]);

            const expressionsItems = zip(
                globalExpressionsList,
                expressionsInfoOrNotReady
            ).map(([exp, info]) =>
                info.err
                    ? new ErrorWatchTreeItem(
                          exp,
                          errorMessage(info),
                          "expression"
                      )
                    : new ExpressionWatchTreeItem(
                          exp,
                          info.safeUnwrap()[0],
                          info.safeUnwrap()[1]
                      )
            );

            // Set the tracking state if was tracked before
            const trackedPythonObjects =
                activeDebugSessionData()?.trackedPythonObjects;
            if (trackedPythonObjects !== undefined) {
                const nonErrorItems = [
                    ...variableItems,
                    ...expressionsItems,
                ].filter(isOf(VariableWatchTreeItem, ExpressionWatchTreeItem));
                for (const item of nonErrorItems) {
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
                new ItemsRootTreeItem("Variables", variableItems),
                new ItemsRootTreeItem("Expressions", [
                    ...expressionsItems,
                    AddExpressionWatchTreeItem,
                ]),
            ];
        } else if (element instanceof ItemsRootTreeItem) {
            return element.items;
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
