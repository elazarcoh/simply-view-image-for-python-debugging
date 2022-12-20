import Container from "typedi";
import * as vscode from "vscode";
import { arrayUnique } from "../utils/Utils";
import { Viewable } from "../viewable/Viewable";

export enum PythonObjectTrackingState {
    Tracked = "trackedVariable",
    NotTracked = "nonTrackedVariable",
}

export function buildWatchTreeItemContext(obj: {
    viewables: Viewable[];
    trackingState: PythonObjectTrackingState;
    itemType: "variable" | "expression";
}): string {
    let context = "svifpd:";
    context += obj.trackingState.toString();
    if (obj.viewables.length > 0) {
        context +=
            "-" + arrayUnique(obj.viewables.map((v) => v.group)).join("_");
    }
    if (obj.itemType === "expression") {
        context += "-expressionItem";
    }
    return context;
}

export abstract class PythonObjectTreeItem extends vscode.TreeItem {
    tracking: PythonObjectTrackingState = PythonObjectTrackingState.NotTracked;
    trackingId?: string;

    constructor(
        readonly itemType: "variable" | "expression",
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly viewables: Viewable[]
    ) {
        super(label, collapsibleState);
    }

    get trackingState(): PythonObjectTrackingState {
        return this.tracking;
    }

    public updateContext(): void {
        const context = buildWatchTreeItemContext({
            trackingState: this.tracking,
            itemType: this.itemType,
            viewables: this.viewables,
        });
        this.contextValue = context;
    }

    setTracked(trackingId: string): void {
        this.trackingId = trackingId;
        this.tracking = PythonObjectTrackingState.Tracked;
        this.iconPath = new vscode.ThemeIcon("eye");
        this.updateContext();
    }

    setNonTracked(): void {
        this.trackingId = undefined;
        this.tracking = PythonObjectTrackingState.NotTracked;
        this.iconPath = undefined;
        this.updateContext();
    }
}

export class PythonObjectInfoLineTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }
    static readonly contextValue = "infoItem";
    readonly contextValue = PythonObjectInfoLineTreeItem.contextValue;
}

// // Image Watch view buttons commands
// const watchTree = Container.get(WatchTreeProvider);
// const variablesList = Container.get(VariablesList);
// export const commands = [
//     // track/untrack tree item
//     [
//         "svifpd.watch-track-enable",
//         (watchVariable: PythonObjectTreeItem): void => {
//             const trackingId = track(watchVariable);
//             watchVariable.setTracked(trackingId);
//             watchTree.refresh();
//         },
//     ],
//     [
//         "svifpd.watch-track-disable",
//         (watchVariable: PythonObjectTreeItem): void => {
//             if (watchVariable.trackingId !== undefined) {
//                 untrack(watchVariable.trackingId);
//             }
//             watchVariable.setNonTracked();
//             watchTree.refresh();
//         },
//     ],
//     // refresh tree
//     [
//         "svifpd.watch-refresh",
//         async (): Promise<void> => {
//             await variablesList.updateVariables();
//             watchTree.refresh();
//         },
//     ],
//     // Open Image Watch settings
//     [
//         "svifpd.open-watch-settings",
//         async () =>
//             vscode.commands.executeCommand("workbench.action.openSettings", {
//                 query: "svifpd.imageWatch.objects",
//             }),
//     ],
// ];
