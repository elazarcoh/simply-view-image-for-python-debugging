import * as vscode from "vscode";
// import 'reflect-metadata';
// import { Container } from 'typedi';
// import { DebugProtocol } from "vscode-debugprotocol";
import { initLog, logDebug, logTrace } from "./Logging";
import { NumpyImage, PillowImage } from "./viewable/Image";
import { createDebugAdapterTracker } from "./debugger-utils/DebugAdapterTracker";
import Container from "typedi";
import { AllViewables } from "./AllViewables";
import { viewablesSetupCode } from "./python-communication/BuildPythonCode";
import { findExpressionViewables } from "./PythonObjectInfo";
import { execInPython } from "./python-communication/RunPythonCode";
import { CodeActionProvider } from "./CodeActionProvider";
import { EXTENSION_CONFIG_SECTION, getConfiguration } from "./config";
import { EXTENSION_NAME } from "./globals";
import { ObjectType } from "./viewable/Viewable";
import { viewObject } from "./ViewPythonObject";
import { registerCommand, registerExtensionCommands } from "./commands";
import { setSaveLocation } from "./SerializationHelper";
import { PlotlyFigure, PyplotAxes, PyplotFigure } from "./viewable/Plot";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";

function onConfigChange(): void {
    initLog();
}

export function activate(context: vscode.ExtensionContext): void {
    onConfigChange();

    setSaveLocation(context);

    vscode.workspace.onDidChangeConfiguration((config) => {
        if (config.affectsConfiguration(EXTENSION_CONFIG_SECTION)) {
            onConfigChange();
        }
    });

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
    allViewables.addViewable(PlotlyFigure);
    allViewables.addViewable(PyplotFigure);
    allViewables.addViewable(PyplotAxes);

    logDebug("Registering code actions provider (the lightbulb)");
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "python",
            new CodeActionProvider(),
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

    const watchTreeProvider = Container.get(WatchTreeProvider);
    context.subscriptions.push(
        vscode.debug.onDidChangeActiveDebugSession((session) => {
            if (session !== undefined) {
                const debugSessionData = activeDebugSessionData(session);
                return debugSessionData.currentPythonObjectsList
                    .update()
                    .then(() => watchTreeProvider.refresh());
            }
        })
    );

    context.subscriptions.push(...registerExtensionCommands(context));

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
