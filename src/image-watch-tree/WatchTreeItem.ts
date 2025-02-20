import * as vscode from "vscode";
import { arrayUnique } from "../utils/Utils";
import { Viewable } from "../viewable/Viewable";

enum PythonObjectTrackingState {
  Tracked = "trackedVariable",
  NotTracked = "nonTrackedVariable",
}

function buildWatchTreeItemContext({
  viewables,
  trackingState,
  itemType,
  isError,
}: {
  viewables: ReadonlyArray<Viewable>;
  trackingState: PythonObjectTrackingState;
  itemType: "variable" | "expression";
  isError: true | false;
}): string {
  let context = "svifpd:";
  context += trackingState.toString();
  if (isError) {
    context += "-errorItem";
  }
  if (viewables.length > 0) {
    context += "-" + arrayUnique(viewables.map((v) => v.group)).join("_");
  }
  if (itemType === "expression") {
    context += "-expressionItem";
  }
  return context;
}

export abstract class PythonObjectTreeItem extends vscode.TreeItem {
  tracking: PythonObjectTrackingState = PythonObjectTrackingState.NotTracked;
  trackingId?: TrackingId;
  lastUsedViewable: Viewable;
  savePath?: string;

  constructor(
    readonly itemType: "variable" | "expression",
    label: string,
    public readonly expression: string,
    public readonly viewables: Readonly<NonEmptyArray<Viewable>>,
    public readonly info: Readonly<PythonObjectInformation>,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.lastUsedViewable = viewables[0];
  }

  get trackingState(): PythonObjectTrackingState {
    return this.tracking;
  }

  public updateContext(): void {
    const context = buildWatchTreeItemContext({
      trackingState: this.tracking,
      itemType: this.itemType,
      viewables: this.viewables,
      isError: false,
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

export class ErrorWatchTreeItem extends vscode.TreeItem {
  constructor(
    public readonly expression: string,
    error: string | Error,
    private readonly itemType: "variable" | "expression",
  ) {
    super(expression, vscode.TreeItemCollapsibleState.None);
    this.description = typeof error === "string" ? error : error.message;
    this.updateContext();
  }

  public updateContext(): void {
    const context = buildWatchTreeItemContext({
      trackingState: PythonObjectTrackingState.NotTracked,
      itemType: this.itemType,
      viewables: [],
      isError: true,
    });
    this.contextValue = context;
  }
}

export class PythonObjectInfoLineTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }
  static readonly contextValue = "infoItem";
  readonly contextValue = PythonObjectInfoLineTreeItem.contextValue;
}
