import * as vscode from "vscode";
import { addExpression } from "./image-watch-tree/PythonObjectsList";
import {
    refreshWatchTree,
    trackPythonObjectTreeItem,
    untrackPythonObjectTreeItem,
} from "./image-watch-tree/WatchTreeRelatedCommands";
import { viewObject } from "./ViewPythonObject";

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
    "svifpd.open-watch-settings": openExtensionSettings,
    "svifpd.watch-refresh": refreshWatchTree,
    "svifpd._internal_view-object": viewObject,
    "svifpd.add-expression": addExpression,
    "svifpd.watch-track-enable": trackPythonObjectTreeItem,
    "svifpd.watch-track-disable": untrackPythonObjectTreeItem,
};
type Commands = typeof Commands;
type AvailableCommands = keyof Commands;

type CommandArguments<C extends AvailableCommands> = Parameters<Commands[C]>;
type CommandReturn<C extends AvailableCommands> = ReturnType<Commands[C]>;

export function executeCommand<C extends AvailableCommands>(
    command: C,
    ...args: CommandArguments<C>
): Thenable<CommandReturn<C>> {
    // TODO: check what happens if the command fails
    // @ts-expect-error  // This is expected:
    // For some reason, the vscode.commands.executeCommand can return undefined,
    // but per the documentation, it returns undefined only if the
    // command action returns undefined, which should be handled
    // by the CommandReturn<...> type helper.
    return vscode.commands.executeCommand(command, ...args);
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
    return [
        _registerCommandByName("svifpd._internal_view-object"),
        _registerCommandByName("svifpd.add-expression"),
        _registerCommandByName("svifpd.watch-track-enable"),
        _registerCommandByName("svifpd.watch-track-disable"),
        _registerCommandByName("svifpd.watch-refresh"),
        _registerCommandByName("svifpd.open-watch-settings"),
    ];
}
