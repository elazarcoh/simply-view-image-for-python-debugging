import Container from 'typedi';
import * as vscode from 'vscode';
import { Information } from '../InformationResolver';
import { track, untrack } from './tracked';
import { WatchTreeProvider } from './WatchTreeProvider';
import { VariablesList } from './WatchVariable';

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
  let context = "svifpd:"
  context += obj.trackingState.toString();
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
  trackingId?: string;

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

  setTracked(trackingId: string): void {
    this.trackingId = trackingId;
    this.tracking = VariableTrackingState.tracked;
    this.iconPath = new vscode.ThemeIcon("eye");
    this.updateContext();
  }

  setNonTracked(): void {
    this.trackingId = undefined;
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

// Image Watch view buttons commands
const watchTree = Container.get(WatchTreeProvider);
const variablesList = Container.get(VariablesList);
export const commands = [
  // track/untrack tree item
  [
    "svifpd.watch-track-enable", (watchVariable: WatchTreeItem): void => {
      const trackingId = track(watchVariable);
      watchVariable.setTracked(trackingId);
      watchTree.refresh();
    },
  ],
  [
    "svifpd.watch-track-disable", (watchVariable: WatchTreeItem): void => {
      if (watchVariable.trackingId !== undefined) {
        untrack(watchVariable.trackingId);
      }
      watchVariable.setNonTracked();
      watchTree.refresh();
    },
  ],
  // refresh tree
  [
    "svifpd.watch-refresh", async (): Promise<void> => {
      await variablesList.updateVariables();
      watchTree.refresh();
    },
  ],
  // Open Image Watch settings
  [
    "svifpd.open-watch-settings", async () => vscode.commands.executeCommand(
      "workbench.action.openSettings", { query: "svifpd.imageWatch.objects" }
    )
  ],
]