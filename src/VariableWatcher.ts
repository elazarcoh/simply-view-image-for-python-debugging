import * as vscode from 'vscode';
import { Variable } from './PythonSelection';
import { pythonVariablesService } from './PythonVariablesService';
import { VariableInformation, ViewerService } from './ViewerService';
import { allFulfilled, notEmpty } from './utils';

enum VariableTrackingState {
    tracked = "trackedVariable",
    nonTracked = "nonTrackedVariable",
}

export class VariableWatcher {
    // this variable is used as a workaround. the debugger stopped event is emitted before the variables
    // are instantiated in the debugger, so the first stop results without any variables.
    // so, we add a another call to refresh, which will occur only if no info were acquired yet.
    private _hasInfo: boolean = false;

    // whether the watcher is activate
    private _activated: boolean = false;

    private _variables: VariableItem[] = [];

    constructor(
        private readonly viewServices: ViewerService[],
        private readonly variablesService = pythonVariablesService(),
    ) { }

    get hasInfo() {
        return this._hasInfo;
    }

    activate(): void {
        this._activated = true;
    }

    deactivate(): void {
        this._activated = false;
        this._hasInfo = false;
        this._variables = [];
    }

    async refreshVariablesAndWatches(): Promise<void> {
        if (!this._activated) return;
        const newVariables = await this.acquireVariables();
        if (newVariables === undefined) return;
        this._hasInfo = true;

        const currentVariables = this._variables.reduce(
            (map: Record<string, [VariableTrackingState, string]>, obj: VariableItem) => {
                map[obj.evaluateName] = [obj.trackingState, obj.path];
                return map;
            }, {});

        for (let variable of newVariables) {
            const current = currentVariables[variable.evaluateName];
            if (current !== undefined) {
                const [state, path] = current;
                variable.contextValue = state;
                variable.path = path;
            }
        }

        this._variables = newVariables;

        await allFulfilled(
            this._variables
                .filter(v => v.trackingState === VariableTrackingState.tracked)
                .map(v => v.viewService.save({ variable: v.evaluateName }, v.path)));
    }

    private async acquireVariables() {

        const maybeVariables = await this.variablesService.viewableVariables();
        if (!maybeVariables) return;

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

    variables(): VariableItem[] {
        return this._variables;
    }
}

class WatchVariableTreeItem extends vscode.TreeItem { }

export class VariableItem extends WatchVariableTreeItem {

    public path: string;

    constructor(
        public readonly label: string,
        public readonly evaluateName: string,
        public readonly variableInformation: Record<string, string>,
        public readonly viewService: ViewerService,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded,
    ) {
        super(label, collapsibleState);
        this.path = viewService.pathForSelection({ variable: evaluateName });
    }

    setTracked(): void {
        this.contextValue = VariableTrackingState.tracked;
    }
    setNonTracked(): void {
        this.contextValue = VariableTrackingState.nonTracked;
    }
    contextValue = VariableTrackingState.nonTracked;

    get trackingState(): VariableTrackingState {
        return this.contextValue;
    }
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
    return v.contextValue === VariableTrackingState.nonTracked || v.contextValue === VariableTrackingState.tracked;
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
    constructor(
        private readonly watcherService: VariableWatcher
    ) {
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<WatchVariableTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: WatchVariableTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: WatchVariableTreeItem): Promise<WatchVariableTreeItem[] | null | undefined> {
        if (!this.watcherService.hasInfo) return;

        if (!element) {
            return this.watcherService.variables();
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
