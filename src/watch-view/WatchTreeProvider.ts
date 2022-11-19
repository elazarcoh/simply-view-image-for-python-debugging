import * as vscode from 'vscode';
import { VariableWatchTreeItem } from '../old/WatchVariable';
import { InfoTreeItem } from './WatchTreeItem';
import { logDebug } from '../logging';
import { VariablesList } from './WatchVariable';
import { AddExpressionWatchTreeItem, ExpressionsList, ExpressionWatchTreeItem } from './WatchExpression';

type WatchTreeRootItem =  ExpressionWatchTreeItem | AddExpressionWatchTreeItem | VariableWatchTreeItem ;

@Service()
export class WatchTreeProvider
    implements vscode.TreeDataProvider<WatchTreeRootItem | InfoTreeItem>
{

    private readonly variablesList = new VariablesList();
    private readonly expressionsList = new ExpressionsList();

    private _onDidChangeTreeData = new vscode.EventEmitter<WatchTreeRootItem | InfoTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(
        element: WatchTreeRootItem | InfoTreeItem
    ): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(
        element?: WatchTreeRootItem | InfoTreeItem
    ): Promise<WatchTreeRootItem[] | InfoTreeItem[] | null | undefined> {
        if (!element) {
            const cs: WatchTreeRootItem[] = [
                ...this.variablesList.variables(),
                ...this.expressionsList.expressions(),
            ];
            return cs;
        } else if (element instanceof VariableWatchTreeItem) {
            const keys = Object.keys(element.variableInformation);
            keys.sort();
            return keys.map(
                (k) => new InfoTreeItem(k, element.variableInformation[k])
            );
        } else if (element instanceof ExpressionWatchTreeItem) {
            const expressionInfo = await element.resolveInformation();
            if (expressionInfo.isError) {
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
