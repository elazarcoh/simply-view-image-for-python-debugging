import * as vscode from "vscode";

export type EditorSelection = ExpressionSelection | VariableSelection;

export function isExpressionSelection(
    selection: EditorSelection
): selection is ExpressionSelection {
    return "expression" in selection;
}

export function selectionString(selection: EditorSelection): string {
    if (isExpressionSelection(selection)) {
        return selection.expression;
    } else {
        return selection.variable;
    }
}

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

export async function openImageToTheSide(
    path: string,
    preview: boolean
): Promise<unknown> {
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
