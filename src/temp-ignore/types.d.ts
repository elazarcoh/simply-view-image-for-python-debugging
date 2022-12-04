import type { VariableWatchTreeItem } from "./watch-view/WatchVariable";
import type { ExpressionWatchTreeItem } from "./watch-view/WatchExpression";
import type { WatchTreeItem } from "./watch-view/WatchTreeItem";

type VariableSelection = { variable: string };
type ExpressionSelection = { expression: string };
type UserSelection = VariableSelection | ExpressionSelection;

type PythonObjectRepresentation =
    | VariableSelection
    | ExpressionSelection
    | VariableWatchTreeItem
    | ExpressionWatchTreeItem;

type Trackable = WatchTreeItem;

type ObjectType = { group: string, type: string }
type PythonObjectInformation = {
    types: ObjectType[];
    details: Record<string, string>;
}

