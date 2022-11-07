import * as vscode from "vscode";
import {pythonInformationResolver } from "./InformationResolver";
import { mapValueOrError } from "./ValueOrError";
import { WatchTreeItem } from "./WatchTreeItem";

export class ExpressionsWatcher {
    private _expressions: ExpressionWatchTreeItem[] = [];

    constructor(
        private readonly _informationResolver = pythonInformationResolver()
    ) { }

    expressions(): (ExpressionWatchTreeItem | AddExpressionWatchTreeItem)[] {
        return [
            ... this._expressions,
            new AddExpressionWatchTreeItem()
        ];
    }

    addExpression(expression: string): void {
        const item = new ExpressionWatchTreeItem(
            expression,
        );
        this._expressions.push(item);
    }
}

class AddExpressionWatchTreeItem extends WatchTreeItem {

    constructor(
        public readonly label: string = "Add Expression",
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
    }

    readonly command: vscode.Command = {
        command: `svifpd.add-expression`,
        title: "Add Expression",
        tooltip: "Add Expression",
    };

}

export class ExpressionWatchTreeItem extends WatchTreeItem {

    constructor(
        public readonly expression: string,
        private readonly _informationResolver = pythonInformationResolver(),
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.Collapsed
    ) {
        super(expression, collapsibleState);
    }

    async resolveInformation() {
        return await this._informationResolver.resolveExpression(this.expression);
    }
}
