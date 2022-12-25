import * as vscode from "vscode";
import {
    updateDebugFrameId,
    viewVariableFromVSCodeDebugViewAsImage,
} from "./debugger-utils/DebugRelatedCommands";
import {
    addExpressionTreeItem,
    editExpressionTreeItem,
    removeAllExpressionsTree,
    removeExpressionTreeItem,
} from "./image-watch-tree/WatchExpression";
import {
    refreshWatchTree,
    trackPythonObjectTreeItem,
    untrackPythonObjectTreeItem,
} from "./image-watch-tree/WatchTreeRelatedCommands";
import { viewObject, viewObjectUnderCursor } from "./ViewPythonObject";

// *********************
// Some general commands
// *********************
async function openExtensionSettings(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", {
        query: "svifpd",
    });
}

// *********************************
// VSCode extension commands helpers
// *********************************
export interface TypedCommand<C extends AvailableCommands>
    extends vscode.Command {
    command: C;
    arguments: CommandArguments<C>;
}

const Commands = {
    "svifpd.open-settings": openExtensionSettings,
    "svifpd.watch-refresh": refreshWatchTree,
    "svifpd._internal_view-object": viewObject,
    "svifpd.add-expression": addExpressionTreeItem,
    "svifpd.edit-expression": editExpressionTreeItem,
    "svifpd.remove-expression": removeExpressionTreeItem,
    "svifpd.remove-all-expressions": removeAllExpressionsTree,
    "svifpd.watch-track-enable": trackPythonObjectTreeItem,
    "svifpd.watch-track-disable": untrackPythonObjectTreeItem,
    "svifpd.update-frame-id": updateDebugFrameId,
    "svifpd.view-image": viewObjectUnderCursor,
    "svifpd.view-debug-variable": viewVariableFromVSCodeDebugViewAsImage,
};
type Commands = typeof Commands;
type AvailableCommands = keyof Commands;

type CommandArguments<C extends AvailableCommands> = Parameters<Commands[C]>;
type CommandReturn<C extends AvailableCommands> = ReturnType<Commands[C]>;

export function executeCommand<C extends AvailableCommands>(
    command: C,
    ...args: CommandArguments<C>
): Thenable<CommandReturn<C>> {
    return vscode.commands.executeCommand<CommandReturn<C>>(command, ...args);
}

export function _registerCommandByName<C extends AvailableCommands>(
    command: C
): vscode.Disposable {
    return registerCommand(command, Commands[command]);
}

export function registerCommand<C extends AvailableCommands>(
    command: C,
    action: Commands[C]
): vscode.Disposable {
    return vscode.commands.registerCommand(command, action);
}

export function registerExtensionCommands(
    context: vscode.ExtensionContext
): vscode.Disposable[] {
    // TODO: automate registering
    return [
        _registerCommandByName("svifpd.view-image"),
        _registerCommandByName("svifpd._internal_view-object"),
        _registerCommandByName("svifpd.add-expression"),
        _registerCommandByName("svifpd.edit-expression"),
        _registerCommandByName("svifpd.remove-expression"),
        _registerCommandByName("svifpd.remove-all-expressions"),
        _registerCommandByName("svifpd.watch-track-enable"),
        _registerCommandByName("svifpd.watch-track-disable"),
        _registerCommandByName("svifpd.watch-refresh"),
        _registerCommandByName("svifpd.open-settings"),
        _registerCommandByName("svifpd.update-frame-id"),
        _registerCommandByName("svifpd.view-debug-variable"),
    ];
}
