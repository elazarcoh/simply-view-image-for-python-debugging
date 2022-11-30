import { chmodSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import 'reflect-metadata';
import { Container } from 'typedi';
import * as vscode from "vscode";
import { DebugProtocol } from "vscode-debugprotocol";
import { initLog, logDebug, logTrace } from "./utils/Logging";
import { extensionConfigSection, getConfiguration } from "./config";
// import { UserSelection, VariableSelection } from "./PythonSelection";
// import { pythonVariablesService } from "./PythonVariablesService";
// import { DebugVariablesTracker } from "./DebugVariablesTracker";
// import { openImageToTheSide } from "./open-image";
// import { WatchTreeProvider } from "./watch-view/WatchTreeProvider";
// import { ExpressionsList } from "./watch-view/WatchExpression";
// import { VariablesList } from './watch-view/WatchVariable';
// import { save } from './save-object';
// import { PythonObjectRepresentation, PYTHON_OBJECTS } from './python-object';
// import { WatchTreeItem } from './watch-view/WatchTreeItem';

// import viewables to register them
import './viewable/Image';
import { createDebugAdapterTracker } from "./debugger-utils/DebugVariablesTracker";
import { WatchTreeProvider } from "./watch-view/WatchTreeProvider";


const WORKING_DIR = "svifpd";

function onConfigChange(): void {
  initLog();
}


export function activate(context: vscode.ExtensionContext): void {

  onConfigChange();
  vscode.workspace.onDidChangeConfiguration(config => {
    if (config.affectsConfiguration(extensionConfigSection)) {
      onConfigChange();
    }
  });

  const usetmp = getConfiguration("useTmpPathToSave");
  let dir = context.globalStorageUri.fsPath;
  if (usetmp || dir === undefined) {
    dir = tmpdir();
    dir = join(dir, WORKING_DIR);
  }
  logDebug(`Using ${dir} as save directory`);

  // create output directory if it doesn't exist
  if (existsSync(dir)) {
    logDebug("cleanup old files in save directory");
    const files = readdirSync(dir);
    files.forEach((file) => {
      const curPath = join(dir, file);
      unlinkSync(curPath);
    });
  } else {
    logDebug("create save directory");
    mkdirSync(dir);
    if (usetmp) {
      chmodSync(dir, 0o777); // make the folder world writable for other users uses the extension
    }
  }

  // register the debug adapter tracker
  logDebug("Registering debug adapter tracker for python");
  vscode.debug.registerDebugAdapterTrackerFactory("python", {
    createDebugAdapterTracker
  });
  logDebug("Registering debug adapter tracker for python-Jupyter");
  vscode.debug.registerDebugAdapterTrackerFactory("Python Kernel Debug Adapter", {
    createDebugAdapterTracker
  });

  logDebug("Registering code actions provider (the lightbulb)");
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "python",
      new PythonViewImageProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.Empty] }
    )
  );

  logDebug("Registering image watch tree view provider");
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "pythonDebugImageWatch",
      Container.get(WatchTreeProvider)
    )
  );

  // add commands
  logDebug("Registering commands");

  // image watch track commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-track-enable",
      async (watchVariable: WatchTreeItem) => {
        watchVariable.setTracked();
        watchTreeProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-track-disable",
      async (watchVariable: WatchTreeItem) => {
        watchVariable.setNonTracked();
        watchTreeProvider.refresh();
      }
    )
  );

  // image watch manual refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand("svifpd.watch-refresh", async () => {
      await variablesList.updateVariables();
      watchTreeProvider.refresh();
    })
  );

  // image watch open settings
  context.subscriptions.push(
    vscode.commands.registerCommand("svifpd.open-watch-settings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", {
        query: "svifpd.imageWatch.objects",
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.view-debug-variable",
      async ({ variable }) => {
        const variableSelection: VariableSelection = {
          variable: variable.evaluateName
        }
        const path = await save(variableSelection);
        if (path === undefined) {
          return;
        }
        await openImageToTheSide(path, true);
      }
    )
  );

  // Add expression command
  const expressionsList = Container.get(ExpressionsList);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      `svifpd.add-expression`,
      async () => {
        // const maybeExpression = await vscode.window.showInputBox({
        //   prompt: "Enter expression to watch",
        //   placeHolder: "e.g. images[0]",
        //   ignoreFocusOut: true,
        // });
        const maybeExpression = "images[0]";
        if (maybeExpression !== undefined) {
          const p = expressionsList.addExpression(maybeExpression);
          watchTreeProvider.refresh();
          return p;
        }
      }
    )
  );
}


export class PythonViewImageProvider implements vscode.CodeActionProvider {
  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<vscode.Command[] | undefined> {
    if (vscode.debug.activeDebugSession === undefined) {
      return undefined;
    }

    const userSelection = await pythonVariablesService().userSelection(
      document,
      range
    );
    if (userSelection === undefined) {
      return;
    }

    return undefined;
    //   const command = await inspectToGetCommand(userSelection);
    //   if (command !== undefined) {
    //     return [command];
    //   } else {
    //     return undefined;
    //   }
  }
}
