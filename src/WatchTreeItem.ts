import * as vscode from 'vscode';
import { Information } from './InformationResolver';

export enum VariableTrackingState {
  tracked = "trackedVariable",
  nonTracked = "nonTrackedVariable",
}

export function buildWatchTreeItemContext(
  obj: {
    info?: Information,
    trackingState: VariableTrackingState,
    itemType: "variable" | "expression",
  }
): string {
  let context = obj.trackingState.toString();
  if (obj.info !== undefined) {
    context += "-" + obj.info.types.map(t => t.group).join("_")
  }
  if (obj.itemType === "expression") {
    context += "-expressionItem";
  }
  return context;
}

export abstract class WatchTreeItem extends vscode.TreeItem {

  tracking: VariableTrackingState = VariableTrackingState.nonTracked;
  info?: Information;

  constructor(
    readonly itemType: "variable" | "expression",
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }

  get trackingState(): VariableTrackingState {
    return this.tracking;
  }

  public updateContext(): void {
    const context = buildWatchTreeItemContext({
      trackingState: this.tracking,
      itemType: this.itemType,
      info: this.info,
    });
    this.contextValue = context;
  }

  setTracked(): void {
    this.tracking = VariableTrackingState.tracked;
    this.iconPath = new vscode.ThemeIcon("eye");
    this.updateContext();
  }

  setNonTracked(): void {
    this.tracking = VariableTrackingState.nonTracked;
    this.iconPath = undefined;
    this.updateContext();
  }

}

export class InfoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }
  static readonly contextValue = "infoItem";
  readonly contextValue = InfoTreeItem.contextValue;
}
