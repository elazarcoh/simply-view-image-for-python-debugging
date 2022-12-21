import Container from "typedi";
import * as vscode from "vscode";
import { arrayUnique } from "../utils/Utils";
import { Viewable } from "../viewable/Viewable";

export enum PythonObjectTrackingState {
    Tracked = "trackedVariable",
    NotTracked = "nonTrackedVariable",
}

export function buildWatchTreeItemContext({
    viewables,
    trackingState,
    itemType,
}: {
    viewables: ReadonlyArray<Viewable>;
    trackingState: PythonObjectTrackingState;
    itemType: "variable" | "expression" | "error";
}): string {
    let context = "svifpd:";
    context += trackingState.toString();
    if (itemType === "error") {
        context += "-errorItem";
    } else {
        if (viewables.length > 0) {
            context +=
                "-" + arrayUnique(viewables.map((v) => v.group)).join("_");
        }
        if (itemType === "expression") {
            context += "-expressionItem";
        }
    }
    return context;
}

export abstract class PythonObjectTreeItem extends vscode.TreeItem {
    tracking: PythonObjectTrackingState = PythonObjectTrackingState.NotTracked;
    trackingId?: TrackingId;

    constructor(
        readonly itemType: "variable" | "expression",
        label: string,
        public readonly expression: string,
        public readonly viewables: ReadonlyArray<Viewable>,
        public readonly info: Readonly<PythonObjectInformation>,
        public readonly isError: true | false = false,
        collapsibleState: vscode.TreeItemCollapsibleState
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

    setTracked(trackingId: TrackingId): void {
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

export class ErrorWatchTreeItem extends PythonObjectTreeItem {
    constructor(public readonly expression: string, error: string | Error) {
        super(
            "variable",
            expression,
            expression,
            [] as Viewable[],
            {} as PythonObjectInformation,
            true,
            vscode.TreeItemCollapsibleState.None
        );
        this.updateContext();
        this.description = typeof error === "string" ? error : error.message;
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
//     // Open Image Watch settings
//     [
//         ,
//         async () =>
//             vscode.commands.executeCommand("workbench.action.openSettings", {
//                 query: "svifpd.imageWatch.objects",
//             }),
//     ],
// ];
