import * as vscode from 'vscode';

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
