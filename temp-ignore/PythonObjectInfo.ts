import { isVariableSelection } from "./PythonSelection";
import type { ExpressionSelection, PythonObjectInformation, PythonObjectRepresentation, VariableSelection } from "./types";
import { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";
import { VariableWatchTreeItem } from "./watch-view/WatchVariable";

async function expressionInfo(
    expression: ExpressionSelection,
): Promise<PythonObjectInformation | undefined> {

    throw new Error("Not implemented");
}

async function variableInfo(
    variable: VariableSelection,
): Promise<PythonObjectInformation | undefined> {

    throw new Error("Not implemented");
}

async function variableWatchTreeItemInfo(
    item: VariableWatchTreeItem,
): Promise<PythonObjectInformation | undefined> {

    throw new Error("Not implemented");
}

async function expressionWatchTreeItemInfo(
    item: ExpressionWatchTreeItem
): Promise<PythonObjectInformation | undefined> {

    throw new Error("Not implemented");
}

export namespace Python.PythonObject {

export async function info(
    obj: PythonObjectRepresentation
): Promise<PythonObjectInformation | undefined> {
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

}