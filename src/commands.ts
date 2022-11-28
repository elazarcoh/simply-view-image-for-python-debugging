import * as vscode from 'vscode';
import { Container } from 'typedi';
import { WatchTreeProvider } from "./watch-view/WatchTreeProvider";
import { currentUserSelection } from './VSCodeEditorUtils';
import { save } from './SavePythonObject';
import { openImageToTheSide } from './OpenImage';
import { handleError } from './ErrorHandling';
import { PythonObjectRepresentation } from './python-object';

async function viewObject(obj: PythonObjectRepresentation): Promise<void> {
    const path = await save(obj);
    if (path.isError) {
        return handleError(path.error);
    }
    await openImageToTheSide(path.result, true);
}

async function viewFromEditor(editor: vscode.TextEditor): Promise<void> {
    const userSelection = currentUserSelection(
        editor.document,
        editor.selection
    );
    return viewObject(userSelection);
}

async function updateDebugFrameId(): Promise<void> {
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

export function registerObjectGroup(
    groupName: string,
): vscode.Disposable[] {
    return [
        vscode.commands.registerTextEditorCommand(`svifpd.view-${groupName}`, viewFromEditor),
        vscode.commands.registerCommand(`svifpd.watch-view-${groupName}`, viewObject),
    ]
}
