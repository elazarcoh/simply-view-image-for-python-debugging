import "reflect-metadata";
import * as vscode from "vscode";
import { initLog, logDebug, logTrace } from "./Logging";
import { NumpyImage, PillowImage } from "./viewable/Image";
import { createDebugAdapterTracker } from "./debugger-utils/DebugAdapterTracker";
import Container from "typedi";
import { AllViewables } from "./AllViewables";
import { CodeActionProvider } from "./CodeActionProvider";
import { EXTENSION_CONFIG_SECTION } from "./config";
import { registerExtensionCommands } from "./commands";
import { setSaveLocation } from "./SerializationHelper";
import { PlotlyFigure, PyplotAxes, PyplotFigure } from "./viewable/Plot";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";
import { NumpyTensor, TorchTensor } from "./viewable/Tensor";
import { hasValue } from "./utils/Utils";
// import { api } from "./api";
import { setupPluginManager } from "./plugins";
import { HelloWorldPanel } from "./webview/panels/HelloWorldPanel";
import { HoverProvider } from "./HoverProvider";

function onConfigChange(): void {
    initLog();
}

// ts-unused-exports:disable-next-line
export function activate(context: vscode.ExtensionContext) {
    onConfigChange();

    logTrace("Activating extension");

    setupPluginManager(context);

    setSaveLocation(context);

    vscode.workspace.onDidChangeConfiguration((config) => {
        if (config.affectsConfiguration(EXTENSION_CONFIG_SECTION)) {
            onConfigChange();
        }
    });

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
    context.subscriptions.push(
        ...[
            allViewables.addViewable(NumpyImage),
            allViewables.addViewable(PillowImage),
            allViewables.addViewable(PlotlyFigure),
            allViewables.addViewable(PyplotFigure),
            allViewables.addViewable(PyplotAxes),
            allViewables.addViewable(NumpyTensor),
            allViewables.addViewable(TorchTensor),
        ].filter(hasValue)
    );

    logDebug("Registering code actions provider (the lightbulb)");
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "python",
            new CodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.Empty] }
        )
    );

    logDebug("Registering hover provider (for shape info)");
    context.subscriptions.push(
        vscode.languages.registerHoverProvider("python", new HoverProvider())
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

    context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession((session) => {
            return activeDebugSessionData(
                session
            ).savePathHelper.deleteSaveDir();
        })
    );

    context.subscriptions.push(...registerExtensionCommands(context));

    // TODO: Disabled for now, until I decide it's ready to be used.
    // return { ...api };

    // const panel = createPanel(context.extensionUri);
    // if (panel) context.subscriptions.push(panel);
    // Create the show hello world command

    context.subscriptions.push(
        vscode.commands.registerCommand("svifpd.open-settings", async () => {
            HelloWorldPanel.render(context);
            setTimeout(() => {
                if(HelloWorldPanel.currentPanel !== undefined) {
                    HelloWorldPanel.currentPanel.postMessage({ command: 'hello', text: 'extension hello world' });
                }
            }, 1000);
        })
    );
}
