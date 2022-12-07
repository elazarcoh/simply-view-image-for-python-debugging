import * as vscode from "vscode";
import { chmodSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// import 'reflect-metadata';
// import { Container } from 'typedi';
// import { DebugProtocol } from "vscode-debugprotocol";
import { initLog, logDebug, logTrace } from "./Logging";
import { combineSetupCodes, evaluateExpressionPythonCode } from "./python-communication/BuildPythonCode";
import { NumpyImage, PillowImage } from "./viewable/Image";
import { createDebugAdapterTracker } from "./debugger-utils/DebugAdapterTracker";
// import { extensionConfigSection, getConfiguration } from "./config";
// // import viewables to register them
// import './viewable/Image';
// import { createDebugAdapterTracker } from "./temp-ignore/debugger-utils/DebugVariablesTracker";
// import { WatchTreeProvider } from "./watch-view/WatchTreeProvider";
// import { CodeActionProvider } from "./CodeActionProvider";
// import { commands } from "./commands";


const WORKING_DIR = "svifpd";

function onConfigChange(): void {
  initLog();
}

// function initWorkingDir(context: vscode.ExtensionContext): void {

//   const usetmp = getConfiguration("useTmpPathToSave");
//   let dir = context.globalStorageUri.fsPath;
//   if (usetmp || dir === undefined) {
//     dir = tmpdir();
//     dir = join(dir, WORKING_DIR);
//   }
//   logDebug(`Using ${dir} as save directory`);

//   // create output directory if it doesn't exist
//   if (existsSync(dir)) {
//     logDebug("cleanup old files in save directory");
//     const files = readdirSync(dir);
//     files.forEach((file) => {
//       const curPath = join(dir, file);
//       unlinkSync(curPath);
//     });
//   } else {
//     logDebug("create save directory");
//     mkdirSync(dir);
//     if (usetmp) {
//       chmodSync(dir, 0o777); // make the folder world writable for other users uses the extension
//     }
//   }

//   Container.set("workingDir", dir);
// }

export function activate(context: vscode.ExtensionContext): void {

  onConfigChange();
  // vscode.workspace.onDidChangeConfiguration(config => {
  //   if (config.affectsConfiguration(extensionConfigSection)) {
  //     onConfigChange();
  //   }
  // });

  logTrace("Activating extension");


  // register the debug adapter tracker
  logDebug("Registering debug adapter tracker for python");
  vscode.debug.registerDebugAdapterTrackerFactory("python", { createDebugAdapterTracker });
  logDebug("Registering debug adapter tracker for python-Jupyter");
  vscode.debug.registerDebugAdapterTrackerFactory("Python Kernel Debug Adapter", { createDebugAdapterTracker });

  // logDebug("Registering code actions provider (the lightbulb)");
  // context.subscriptions.push(
  //   vscode.languages.registerCodeActionsProvider(
  //     "python",
  //     new CodeActionProvider(),
  //     { providedCodeActionKinds: [vscode.CodeActionKind.Empty] }
  //   )
  // );

  // logDebug("Registering image watch tree view provider");
  // context.subscriptions.push(
  //   vscode.window.registerTreeDataProvider(
  //     "pythonDebugImageWatch",
  //     Container.get(WatchTreeProvider)
  //   )
  // );

  // // add commands
  // logDebug("Registering commands");
  // for (const [id, action] of commands) {
  //   logDebug(`Registering command "${id}"`);
  //   context.subscriptions.push(
  //     vscode.commands.registerCommand(id, action)
  //   );
  // }

  // // // Add expression command
  // // const expressionsList = Container.get(ExpressionsList);
  // // context.subscriptions.push(
  // //   vscode.commands.registerCommand(
  // //     `svifpd.add-expression`,
  // //     async () => {
  // //       // const maybeExpression = await vscode.window.showInputBox({
  // //       //   prompt: "Enter expression to watch",
  // //       //   placeHolder: "e.g. images[0]",
  // //       //   ignoreFocusOut: true,
  // //       // });
  // //       const maybeExpression = "images[0]";
  // //       if (maybeExpression !== undefined) {
  // //         const p = expressionsList.addExpression(maybeExpression);
  // //         watchTreeProvider.refresh();
  // //         return p;
  // //       }
  // //     }
  // //   )
  // // );
}

