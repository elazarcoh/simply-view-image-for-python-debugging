import * as vscode from "vscode";
import { Information, pythonInformationResolver } from "./InformationResolver";
import { mapValueOrError, ValueOrError } from "./ValueOrError";
import { buildWatchTreeItemContext, VariableTrackingState, WatchTreeItem } from "./WatchTreeItem";

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

    async addExpression(expression: string): Promise<void> {
        const item = new ExpressionWatchTreeItem(
            expression,
        );
        this._expressions.push(item);
        await item.resolveInformation();
        return;
    }
}

// TODO: do not export
export class AddExpressionWatchTreeItem extends vscode.TreeItem {

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
        super("expression", expression, collapsibleState);
    }

    async resolveInformation(): Promise<ValueOrError<Information>> {
        const info = await this._informationResolver.resolveExpression(this.expression);
        mapValueOrError(info, (i) => this.contextValue = buildWatchTreeItemContext({
            info: i,
            trackingState: this.tracking,
            itemType: "expression",
        }));
        return info;
    }
}
