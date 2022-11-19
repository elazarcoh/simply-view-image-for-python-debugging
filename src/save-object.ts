import type { PythonObjectRepresentation } from "./python-object";
import { ExpressionSelection, isVariableSelection, VariableSelection } from "./PythonSelection";
import { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";
import { VariableWatchTreeItem } from "./watch-view/WatchVariable";

async function saveExpression(
    expression: ExpressionSelection,
) {

}

async function saveVariable(
    variable: VariableSelection,
) {

}

async function saveVariableTreeItem(
    item: VariableWatchTreeItem,
) {

}

async function saveExpressionTreeItem(
    item: ExpressionWatchTreeItem
) {

}

export async function save(
    obj: PythonObjectRepresentation
) {
    if (obj instanceof VariableWatchTreeItem) {
        return await saveVariableTreeItem(obj);
    } else if (obj instanceof ExpressionWatchTreeItem) {
        return await saveExpressionTreeItem(obj);
    } else if (isVariableSelection(obj)) {
        return await saveVariable(obj);
    } else {
        return await saveExpression(obj);
    }
}
