import type { VariableWatchTreeItem } from "./watch-view/WatchVariable";
import type { ExpressionSelection, VariableSelection } from "./PythonSelection";
import type { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";

type PythonObjectRepresentation =
    | VariableSelection
    | ExpressionSelection
    | VariableWatchTreeItem
    | ExpressionWatchTreeItem;
