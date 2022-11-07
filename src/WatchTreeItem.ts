import * as vscode from 'vscode';
import { Information } from './InformationResolver';
import { ObjectTypeGroup } from './supported-services';

export enum VariableTrackingState {
  tracked = "trackedVariable",
  nonTracked = "nonTrackedVariable",
}

export function buildWatchTreeItemContext(
  obj: {
    info: Information
    trackingState: VariableTrackingState
  }
): string {
  return obj.trackingState + "-" + obj.info.types.join("_");
}

export class WatchTreeItem extends vscode.TreeItem { }

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
