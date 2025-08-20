import Container from 'typedi';
import * as vscode from 'vscode';
import {
  addExpressionTreeItem,
  editExpressionTreeItem,
  removeAllExpressionsTree,
  removeExpressionTreeItem,
} from './image-watch-tree/WatchExpression';
import {
  refreshWatchTree,
  trackPythonObjectTreeItem,
  untrackPythonObjectTreeItem,
} from './image-watch-tree/WatchTreeRelatedCommands';
import { openFileImage } from './ImagePreviewCustomEditor';
import {
  JUPYTER_VIEW_COMMAND,
  viewVariableFromJupyterDebugView,
} from './jupyter-intergration';
import { logTrace } from './Logging';
import { disablePluginCommand } from './plugins';
import { runSetup } from './python-communication/Setup';
import {
  updateDebugFrameId,
  viewVariableFromVSCodeDebugViewAsImage,
} from './session/debugger/DebugRelatedCommands';
import { activeDebugSessionData } from './session/debugger/DebugSessionsHolder';
import { debugSession } from './session/Session';
import {
  trackObjectUnderCursor,
  viewObject,
  viewObjectUnderCursor,
} from './ViewPythonObject';
import { GlobalWebviewClient } from './webview/communication/WebviewClient';

// *********************
// Some general commands
// *********************
async function openExtensionSettings(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', {
    query: 'svifpd',
  });
}
async function openImageWebview(): Promise<void> {
  Container.get(GlobalWebviewClient).reveal();
}
async function rerunSetup(): Promise<void> {
  const session = vscode.debug.activeDebugSession;
  if (session) {
    await runSetup(debugSession(session), true);
  }
}
async function updateDiagnostics(): Promise<void> {
  const debugSessionData = activeDebugSessionData();
  await debugSessionData?.diagnostics.update();
}

// *********************************
// VSCode extension commands helpers
// *********************************
export interface TypedCommand<C extends AvailableCommands>
  extends vscode.Command {
  command: C;
  arguments: CommandArguments<C>;
}

const COMMANDS = {
  'svifpd.run-setup': rerunSetup,
  'svifpd.open-settings': openExtensionSettings,
  'svifpd.open-image-webview': openImageWebview,
  'svifpd.watch-refresh': refreshWatchTree,
  'svifpd._internal_view-object': viewObject,
  'svifpd.add-expression': addExpressionTreeItem,
  'svifpd.edit-expression': editExpressionTreeItem,
  'svifpd.remove-expression': removeExpressionTreeItem,
  'svifpd.remove-all-expressions': removeAllExpressionsTree,
  'svifpd.watch-track-enable': trackPythonObjectTreeItem,
  'svifpd.watch-track-disable': untrackPythonObjectTreeItem,
  'svifpd.update-frame-id': updateDebugFrameId,
  'svifpd.view-image': viewObjectUnderCursor,
  'svifpd.view-image-track': trackObjectUnderCursor,
  'svifpd.view-debug-variable': viewVariableFromVSCodeDebugViewAsImage,
  'svifpd.disable-plugin': disablePluginCommand,
  'svifpd.update-diagnostics': updateDiagnostics,
  'svifpd.open-file-image': openFileImage,
  [JUPYTER_VIEW_COMMAND]: viewVariableFromJupyterDebugView,
};
type Commands = typeof COMMANDS;
type AvailableCommands = keyof Commands;

type CommandArguments<C extends AvailableCommands> = Parameters<Commands[C]>;
type CommandReturn<C extends AvailableCommands> = ReturnType<Commands[C]>;

// ts-unused-exports:disable-next-line
export function executeCommand<C extends AvailableCommands>(
  command: C,
  ...args: CommandArguments<C>
): Thenable<CommandReturn<C>> {
  return vscode.commands.executeCommand<CommandReturn<C>>(command, ...args);
}

function _registerCommandByName<C extends AvailableCommands>(
  command: C,
): vscode.Disposable {
  return registerCommand(command, COMMANDS[command]);
}

function registerCommand<C extends AvailableCommands>(
  command: C,
  action: Commands[C],
): vscode.Disposable {
  logTrace(`Registering command: ${command}`);
  return vscode.commands.registerCommand(command, action);
}

export function registerExtensionCommands(
  _context: vscode.ExtensionContext,
): vscode.Disposable[] {
  // TODO: automate registering
  return [
    _registerCommandByName('svifpd.run-setup'),
    _registerCommandByName('svifpd.view-image'),
    _registerCommandByName('svifpd.view-image-track'),
    _registerCommandByName('svifpd._internal_view-object'),
    _registerCommandByName('svifpd.add-expression'),
    _registerCommandByName('svifpd.edit-expression'),
    _registerCommandByName('svifpd.remove-expression'),
    _registerCommandByName('svifpd.remove-all-expressions'),
    _registerCommandByName('svifpd.watch-track-enable'),
    _registerCommandByName('svifpd.watch-track-disable'),
    _registerCommandByName('svifpd.watch-refresh'),
    _registerCommandByName('svifpd.open-settings'),
    _registerCommandByName('svifpd.open-image-webview'),
    _registerCommandByName('svifpd.update-frame-id'),
    _registerCommandByName('svifpd.view-debug-variable'),
    _registerCommandByName('svifpd.disable-plugin'),
    _registerCommandByName('svifpd.update-diagnostics'),
    _registerCommandByName('svifpd.open-file-image'),
    _registerCommandByName(JUPYTER_VIEW_COMMAND),
  ];
}
