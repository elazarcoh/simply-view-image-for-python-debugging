import * as vscode from "vscode";
import { Service } from "typedi";
import { Information, pythonInformationResolver } from "../InformationResolver";
import { mapValueOrError, ValueOrError } from "../utils/ValueOrError";
import { buildWatchTreeItemContext, WatchTreeItem } from "./WatchTreeItem";

@Service()
export class VariablesList {
    private _variables: VariableWatchTreeItem[] = [];

    constructor(
        private readonly _informationResolver = pythonInformationResolver()
    ) { }

    variables(): VariableWatchTreeItem[] {
        return this._variables;
    }

    clear(): void {
        this._variables = [];
    }

    async updateVariables(): Promise<void> {}

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
