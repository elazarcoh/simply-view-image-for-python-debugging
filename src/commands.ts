import * as vscode from "vscode";
import { addExpression } from "./image-watch-tree/PythonObjectsList";
import { viewObject } from "./ViewPythonObject";

export interface TypedCommand<C extends AvailableCommands>
    extends vscode.Command {
    command: C;
    arguments: CommandArguments<C>;
}

type CommandWithAction<Fn extends (...args: any[]) => R, R = unknown> = {
    arguments: Parameters<Fn>;
    action: Fn;
};

type Commands = {
    "svifpd._internal_view-object": CommandWithAction<typeof viewObject>;
    "svifpd.add-expression": CommandWithAction<typeof addExpression>;
};
type AvailableCommands = keyof Commands;

type CommandArguments<C extends AvailableCommands> = Commands[C]["arguments"];
type CommandReturn<C extends AvailableCommands> = ReturnType<
    Commands[C]["action"]
>;

export function executeCommand<C extends AvailableCommands>(
    command: C,
    ...args: CommandArguments<C>
): Thenable<CommandReturn<C>> {
    // @ts-expect-error  // This is expected:
    // For some reason, the vscode.commands.executeCommand can return undefined,
    // but per the documentation, it returns undefined only if the
    // command action returns undefined, which should be handled
    // by the CommandReturn<...> type helper.
    return vscode.commands.executeCommand(command, ...args);
}

export function registerCommand<C extends AvailableCommands>(
    command: C,
    action: Commands[C]["action"]
): vscode.Disposable {
    return vscode.commands.registerCommand(command, action);
}

export function registerExtensionCommands(
    context: vscode.ExtensionContext
): vscode.Disposable[] {
    return [
        registerCommand("svifpd._internal_view-object", viewObject),
        registerCommand("svifpd.add-expression", addExpression),
    ];
}
