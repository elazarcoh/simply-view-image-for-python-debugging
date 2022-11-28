import * as vscode from "vscode";
import { Service } from "typedi";
import { WatchTreeItem } from "./WatchTreeItem";

@Service()
export class VariablesList {
    private _variables: VariableWatchTreeItem[] = [];

    variables(): VariableWatchTreeItem[] {
        return this._variables;
    }

    clear(): void {
        this._variables = [];
    }

    updateVariables() : Promise<void> {}
}

export class VariableWatchTreeItem extends WatchTreeItem {

    constructor(
        public readonly variableName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.Collapsed
    ) {
        super("variable", variableName, collapsibleState);
        this.updateContext();
    }

}
