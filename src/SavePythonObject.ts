import type { PythonObjectRepresentation } from "./python-object";
import { ExpressionSelection, isVariableSelection, VariableSelection } from "./PythonSelection";
import { Except } from "./utils/Except";
import { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";
import { VariableWatchTreeItem } from "./watch-view/WatchVariable";

async function saveExpression(
    expression: ExpressionSelection,
): Promise<Except<string>> {
    throw new Error("Not implemented");
}

async function saveVariable(
    variable: VariableSelection,
): Promise<Except<string>> {

    throw new Error("Not implemented");
}

async function saveVariableTreeItem(
    item: VariableWatchTreeItem,
): Promise<Except<string>> {

    throw new Error("Not implemented");
}

async function saveExpressionTreeItem(
    item: ExpressionWatchTreeItem
): Promise<Except<string>> {

    throw new Error("Not implemented");
}

export async function save(
    obj: PythonObjectRepresentation
): Promise<Except<string>> {
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
