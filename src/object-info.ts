import type { PythonObjectRepresentation } from "./python-object";
import { ExpressionSelection, isVariableSelection, VariableSelection } from "./PythonSelection";
import { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";
import { VariableWatchTreeItem } from "./watch-view/WatchVariable";

async function expressionInfo(
    expression: ExpressionSelection,
) {

}

async function variableInfo(
    variable: VariableSelection,
) {

}

async function variableWatchTreeItemInfo(
    item: VariableWatchTreeItem,
) {

}

async function expressionWatchTreeItemInfo(
    item: ExpressionWatchTreeItem
) {

}

export async function info(
    obj: PythonObjectRepresentation
) {
    if (obj instanceof VariableWatchTreeItem) {
        return await variableWatchTreeItemInfo(obj);
    } else if (obj instanceof ExpressionWatchTreeItem) {
        return await expressionWatchTreeItemInfo(obj);
    } else if (isVariableSelection(obj)) {
        return await variableInfo(obj);
    } else {
        return await expressionInfo(obj);
    }
}

