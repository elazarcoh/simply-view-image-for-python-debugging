import * as vscode from 'vscode';

// update currently selected frame, using a hacky way (because the vscode API is lacking).
export async function updateDebugFrameId(): Promise<void> {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor) {
        const prevSelection = activeTextEditor.selection;
        let whitespaceLocation = null;
        for (let i = 0; i < activeTextEditor.document.lineCount && whitespaceLocation === null; i++) {
            const line = activeTextEditor.document.lineAt(i);
            const whitespaceIndex = line.text.search(/\s/);
            if (whitespaceIndex !== -1) {
                whitespaceLocation = new vscode.Position(i, whitespaceIndex);
            }
        }
        if (whitespaceLocation === null) return;
        activeTextEditor.selection = new vscode.Selection(whitespaceLocation, whitespaceLocation.translate({ characterDelta: 1 }));
        await vscode.commands.executeCommand('editor.debug.action.selectionToRepl', {}).then(() => {
            activeTextEditor.selection = prevSelection;
        });
    }
}

export const commands: [string, () => Promise<unknown>][] = [
    ["svifpd.update-frame-id", updateDebugFrameId],
];

