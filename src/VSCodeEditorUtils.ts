import * as vscode from 'vscode';
import { ExpressionSelection, VariableSelection } from './PythonSelection';

export type EditorSelection = ExpressionSelection | VariableSelection;

export function currentUserSelection(
    document: vscode.TextDocument,
    range: vscode.Range
): EditorSelection {
    const selected = document.getText(range);
    if (selected !== "") {
        return { expression: selected }; // the user selection
    }

    // the user not selected a range. need to figure out which variable he's on
    const selectedVariable = document.getText(
        document.getWordRangeAtPosition(range.start)
    );
    return {
        variable: selectedVariable
    }
}
