import Container from "typedi";
import * as vscode from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { Viewable } from "../viewable/Viewable";
import {
    addExpression,
    editExpression,
    removeAllExpressions,
    removeExpression,
} from "./PythonObjectsList";
import { PythonObjectTreeItem } from "./WatchTreeItem";
import { WatchTreeProvider } from "./WatchTreeProvider";

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

export async function addExpressionTreeItem(): Promise<void> {
    const added = await addExpression();
    if (added) {
        await activeDebugSessionData()?.currentPythonObjectsList.update();
        Container.get(WatchTreeProvider).refresh();
    }
}

export async function removeExpressionTreeItem(
    item: ExpressionWatchTreeItem
): Promise<void> {
    const expression = item.expression;
    const removed = await removeExpression(expression);
    if (removed) {
        if (item.trackingId) {
            activeDebugSessionData()?.trackedPythonObjects.untrack(
                item.trackingId
            );
        }
        await activeDebugSessionData()?.currentPythonObjectsList.update();
        Container.get(WatchTreeProvider).refresh();
    }
}

export async function editExpressionTreeItem(
    item: ExpressionWatchTreeItem
): Promise<void> {
    const expression = item.expression;
    const changed = await editExpression(expression);
    if (changed) {
        await activeDebugSessionData()?.currentPythonObjectsList.update();
        Container.get(WatchTreeProvider).refresh();
    }
}

export async function removeAllExpressionsTree(): Promise<void> {
    const removed = removeAllExpressions();
    if (removed.length > 0) {
        const trackedPythonObjects =
            activeDebugSessionData()?.trackedPythonObjects;
        if (trackedPythonObjects !== undefined) {
            removed.forEach((expression) => {
                const trackingId = trackedPythonObjects.trackingIdIfTracked({
                    expression,
                });
                if (trackingId !== undefined) {
                    trackedPythonObjects.untrack(trackingId);
                }
            });
        }
        await activeDebugSessionData()?.currentPythonObjectsList.update();
        Container.get(WatchTreeProvider).refresh();
    }
}
