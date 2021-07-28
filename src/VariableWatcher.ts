import * as vscode from 'vscode';
import { Variable } from './PythonSelection';
import { pythonVariablesService } from './PythonVariablesService';
import { VariableInformation, ViewerService } from './ViewerService';
import { allFulfilled, notEmpty } from './utils';

class WatchVariableTreeItem extends vscode.TreeItem {

}

export class VariableItem extends WatchVariableTreeItem {
    constructor(
        public readonly label: string,
        public readonly evaluateName: string,
        public readonly variableInformation: Record<string, string>,
        public readonly viewService: ViewerService,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded,
    ) {
        super(label, collapsibleState);
    }
    static readonly contextValue = 'variable';
    readonly contextValue = VariableItem.contextValue;
}

class VariableInfoItem extends WatchVariableTreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }
    static readonly contextValue = 'infoItem';
    readonly contextValue = VariableInfoItem.contextValue;
}

function isVariableItem(v: WatchVariableTreeItem): v is VariableItem {
    return v.contextValue === VariableItem.contextValue;
}

class VariableWatcher {

}

async function toWatchVariable(v: Variable, viewerServices: ViewerService[]): Promise<VariableItem | undefined> {
    let watchVariable: [VariableInformation, ViewerService] | undefined;
    for (const viewSrv of viewerServices) {
        const varInfo = await viewSrv.variableInformation({ variable: v.evaluateName })
        if (varInfo !== undefined) {
            watchVariable = [varInfo, viewSrv];
        };
    }
    if (watchVariable === undefined) return;
    const [varInfo, viewSrv] = watchVariable;

    return new VariableItem(
        varInfo.name,
        varInfo.name,
        varInfo.more,
        viewSrv,
    );
}

export class VariableWatchTreeProvider implements vscode.TreeDataProvider<WatchVariableTreeItem>
{
    // this variable is used as a workaround. the debugger stopped event is emitted before the variables
    // are instantiated in the debugger, so the first stop results without any variables.
    // so, we add a another call to refresh, which will occur only if no info were acquired yet.
    private _hasInfo: boolean = false;

    // whether the debugger is activate
    private _debuggerActivated: boolean = false;

    constructor(
        private readonly viewServices: ViewerService[],
        private readonly variablesService = pythonVariablesService(),
    ) {
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<WatchVariableTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    get hasInfo() {
        return this._hasInfo;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    activate(): void {
        this._debuggerActivated = true;
    }

    deactivate(): void {
        this._debuggerActivated = false;
        this.refresh();
    }

    getTreeItem(element: WatchVariableTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: WatchVariableTreeItem): Promise<WatchVariableTreeItem[] | null | undefined> {
        if (!this._debuggerActivated) return [];

        if (!element) {
            const maybeVariables = await this.variablesService.viewableVariables();
            if (!maybeVariables) return [];
            this._hasInfo = true;

            const { locals, globals } = maybeVariables;

            // take only unique variables by name
            const allVariables = [...locals, ...globals];
            const names = allVariables.map(v => v.name);
            const uniqueVariables = allVariables.filter((value, index) => names.indexOf(value.name) === index);

            const items = await allFulfilled(
                uniqueVariables.map(v => toWatchVariable(v, this.viewServices)).filter(notEmpty)
            );
            return items.filter(notEmpty);
        }
        else if (isVariableItem(element)) {
            const keys = Object.keys(element.variableInformation);
            keys.sort();
            return keys.map(k => new VariableInfoItem(k, element.variableInformation[k]));
        }
        else {
            return [];
        }
    }

}
