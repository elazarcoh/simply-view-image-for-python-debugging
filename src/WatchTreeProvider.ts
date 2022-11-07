import * as vscode from 'vscode';
import { VariableWatcher, VariableWatchTreeItem } from './WatchVariable';
import { InfoTreeItem, WatchTreeItem } from './WatchTreeItem';
import { ExpressionsWatcher, ExpressionWatchTreeItem } from './WatchExpression';
import { logDebug, logTrace } from './logging';

export class WatchTreeProvider
    implements vscode.TreeDataProvider<WatchTreeItem>
{
    constructor(
        private readonly variableWatcherService: VariableWatcher,
        private readonly expressionsWatcherService: ExpressionsWatcher,
    ) { }

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
            return [
                ...this.variableWatcherService.variables(),
                ...this.expressionsWatcherService.expressions()
            ];
        } else if (element instanceof VariableWatchTreeItem) {
            const keys = Object.keys(element.variableInformation);
            keys.sort();
            return keys.map(
                (k) => new InfoTreeItem(k, element.variableInformation[k])
            );
        } else if (element instanceof ExpressionWatchTreeItem) {
            const expressionInfo = await element.resolveInformation();
            if(expressionInfo.isError) {
                logDebug(`Error resolving expression ${element.expression}: ${expressionInfo.error}`);
                return [];
            }
            const keys = Object.keys(expressionInfo.result.details);
            keys.sort();
            return keys.map(
                (k) => new InfoTreeItem(k, expressionInfo.result.details[k])
            );
        } else {
            return [];
        }
    }
}