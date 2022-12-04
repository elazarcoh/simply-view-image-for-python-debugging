import type { ExpressionSelection, ObjectType, PythonObjectRepresentation, VariableSelection } from "./types";
import { isVariableSelection } from "./PythonSelection";
import { Except } from "./utils/Except";
import { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";
import { VariableWatchTreeItem } from "./watch-view/WatchVariable";

async function saveExpression(
    expression: ExpressionSelection,
    asType?: ObjectType,
): Promise<Except<string>> {
    throw new Error("Not implemented");
}

async function saveVariable(
    variable: VariableSelection,
    asType?: ObjectType,
): Promise<Except<string>> {

    throw new Error("Not implemented");
}

async function saveVariableTreeItem(
    item: VariableWatchTreeItem,
    asType?: ObjectType,
): Promise<Except<string>> {

    throw new Error("Not implemented");
}

async function saveExpressionTreeItem(
    item: ExpressionWatchTreeItem,
    asType?: ObjectType,
): Promise<Except<string>> {

    throw new Error("Not implemented");
}


export namespace Python.PythonObject {

    export async function save(
        obj: PythonObjectRepresentation,
        asType?: ObjectType,
    ): Promise<Except<string>> {
        if (obj instanceof VariableWatchTreeItem) {
            return await saveVariableTreeItem(obj, asType);
        } else if (obj instanceof ExpressionWatchTreeItem) {
            return await saveExpressionTreeItem(obj, asType);
        } else if (isVariableSelection(obj)) {
            return await saveVariable(obj, asType);
        } else {
            return await saveExpression(obj, asType);
        }
    }

}