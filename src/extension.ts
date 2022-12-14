import * as vscode from "vscode";
// import 'reflect-metadata';
// import { Container } from 'typedi';
// import { DebugProtocol } from "vscode-debugprotocol";
import { initLog, logDebug, logTrace } from "./Logging";
import { NumpyImage, PillowImage } from "./viewable/Image";
import { createDebugAdapterTracker } from "./debugger-utils/DebugAdapterTracker";
import Container from "typedi";
import { AllViewables } from "./AllViewables";
import {
    pythonObjectInfoCode,
    viewablesSetupCode,
} from "./python-communication/BuildPythonCode";
import { findExpressionViewables } from "./PythonObjectInfo";
import { execInPython } from "./python-communication/RunPythonCode";
import { CodeActionProvider } from "./CodeActionProvider";
import { getConfiguration } from "./config";
import { EXTENSION_NAME } from "./globals";
import { ObjectType } from "./viewable/Viewable";
import { viewObject } from "./ViewPythonObject";
import { registerCommand, registerCommands } from "./commands";
import { setSaveLocation } from "./SerializationHelper";
// import { extensionConfigSection, getConfiguration } from "./config";
// // import viewables to register them
// import './viewable/Image';
// import { createDebugAdapterTracker } from "./temp-ignore/debugger-utils/DebugVariablesTracker";
// import { WatchTreeProvider } from "./watch-view/WatchTreeProvider";
// import { CodeActionProvider } from "./CodeActionProvider";
// import { commands } from "./commands";

function onConfigChange(): void {
    initLog();
}

export function activate(context: vscode.ExtensionContext): void {
    onConfigChange();

    setSaveLocation(context);

    // vscode.workspace.onDidChangeConfiguration(config => {
    //   if (config.affectsConfiguration(extensionConfigSection)) {
    //     onConfigChange();
    //   }
    // });

    logTrace("Activating extension");

    // register the debug adapter tracker
    logDebug("Registering debug adapter tracker for python");
    vscode.debug.registerDebugAdapterTrackerFactory("python", {
        createDebugAdapterTracker,
    });
    logDebug("Registering debug adapter tracker for python-Jupyter");
    vscode.debug.registerDebugAdapterTrackerFactory(
        "Python Kernel Debug Adapter",
        { createDebugAdapterTracker }
    );

    const allViewables = Container.get(AllViewables);
    allViewables.addViewable(NumpyImage);
    allViewables.addViewable(PillowImage);

    // context.subscriptions.push(
    //     vscode.commands.registerCommand(
    //         "svifpd.open-watch-settings",
    //         async () => {
    //             await execInPython(
    //                 viewablesSetupCode(),
    //                 vscode.debug.activeDebugSession!
    //             );
    //             const ts = await findExpressionTypes(
    //                 "x",
    //                 vscode.debug.activeDebugSession!
    //             );
    //             logInfo(ts);
    //         }
    //     )
    // );

    logDebug("Registering code actions provider (the lightbulb)");
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "python",
            new CodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.Empty] }
        )
    );

    context.subscriptions.push(...registerCommands(context));

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
