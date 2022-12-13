import * as vscode from "vscode";
import { chmodSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import * as fsp from "path";
// import 'reflect-metadata';
// import { Container } from 'typedi';
// import { DebugProtocol } from "vscode-debugprotocol";
import { initLog, logDebug, logInfo, logTrace } from "./Logging";
import { NumpyImage, PillowImage } from "./viewable/Image";
import { createDebugAdapterTracker } from "./debugger-utils/DebugAdapterTracker";
import Container from "typedi";
import { AllViewables } from "./AllViewables";
import {
    pythonObjectInfoCode,
    viewablesSetupCode,
} from "./python-communication/BuildPythonCode";
import { findExpressionTypes } from "./PythonObjectInfo";
import { execInPython } from "./python-communication/RunPythonCode";
import { CodeActionProvider } from "./CodeActionProvider";
import { getConfiguration } from "./config";
import { EXTENSION_NAME } from "./globals";
import { defaultSaveDir } from "./SerializationHelper";
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

function setSaveLocation(context: vscode.ExtensionContext): void {
    const saveLocation = getConfiguration("saveLocation") ?? "tmp";
    let saveDir: string;
    if (saveLocation === "custom") {
        logDebug("Using custom save location for saving files");
        saveDir = getConfiguration("customSavePath") ?? defaultSaveDir();
    } else if (saveLocation === "extensionStorage") {
        logDebug("Using extension storage for saving files");
        saveDir = fsp.join(
            context.globalStorageUri.fsPath,
            EXTENSION_NAME,
            "images"
        );
    } else {
        logDebug("Using tmp folder for saving files");
        saveDir = fsp.join(tmpdir(), EXTENSION_NAME, "images");
    }

    logDebug("saveDir: " + saveDir);

    // create output directory if it doesn't exist
    if (existsSync(saveDir)) {
        logDebug("cleaning save directory");
        readdirSync(saveDir)
            .map((filename) => fsp.join(saveDir, filename))
            .forEach(unlinkSync);
    } else {
        logDebug("create save directory");
        mkdirSync(saveDir, { recursive: true });
        if (saveLocation === "tmp" || saveLocation === undefined) {
            chmodSync(saveDir, 0o777); // make the folder world writable for other users uses the extension
        }
    }

    Container.set("saveDir", saveDir);
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
