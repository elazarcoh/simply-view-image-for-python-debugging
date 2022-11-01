import * as vscode from 'vscode';
import { VariableWatcher } from './WatchVariable';
import { WatchTreeItem } from './WatchTreeItem';

export class ExpressionWatchTreeItem extends WatchTreeItem { 
    static isinstance(item: WatchTreeItem): item is ExpressionWatchTreeItem {
        return item instanceof ExpressionWatchTreeItem;
    }
}

export class WatchTreeProvider
    implements vscode.TreeDataProvider<WatchTreeItem>
{
    constructor(private readonly watcherService: VariableWatcher) { }

    private _onDidChangeTreeData = new vscode.EventEmitter<WatchTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(
        element: WatchTreeItem
    ): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(
        element?: WatchTreeItem
    ): Promise<WatchTreeItem[] | null | undefined> {
        if (!element) {
            return this.watcherService.variables();
        } else if (VariableWatchTreeItem.isinstance(element)) {
            const keys = Object.keys(element.variableInformation);
            keys.sort();
            return keys.map(
                (k) => new VariableInfoItem(k, element.variableInformation[k])
            );
        } else {
            return [];
        }
    }
}
