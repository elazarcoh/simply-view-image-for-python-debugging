import * as vscode from 'vscode';
import { ExpressionSelection, VariableSelection } from '../types';

export type EditorSelection = ExpressionSelection | VariableSelection;

export function currentUserSelection(
    document: vscode.TextDocument,
    range: vscode.Range
): EditorSelection | undefined {
    const selected = document.getText(range);
    if (selected !== "") {
        return { expression: selected }; // the user selection
    }

    // the user not selected a range. need to figure out which variable he's on
    const selectedVariable = document.getText(
        document.getWordRangeAtPosition(range.start)
    );
    if (selectedVariable !== "") {
        return { variable: selectedVariable };
    } else {
        return undefined;
    }
}

export function openImageToTheSide(path: string, preview: boolean): Thenable<unknown> {
    const options = {
        viewColumn: vscode.ViewColumn.Beside,
        preview: preview,
        preserveFocus: true,
    };
    return vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(path),
        options
    );
}
