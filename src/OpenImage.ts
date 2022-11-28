import * as vscode from "vscode";

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