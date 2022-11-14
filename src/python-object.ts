import type { VariableWatchTreeItem } from "./watch-view/WatchVariable";
import type { ExpressionSelection, VariableSelection } from "./PythonSelection";
import type { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";

export const PYTHON_OBJECTS = [
    'image',
    'plot',
    'tensor',
];

export type PythonObjectRepresentation = VariableSelection | ExpressionSelection | VariableWatchTreeItem | ExpressionWatchTreeItem;
