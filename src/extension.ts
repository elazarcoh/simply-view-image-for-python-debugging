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
import { arrayUnique, hasValue } from "./utils/Utils";
import { api, PluginManager } from "./api";

function onConfigChange(): void {
    initLog();
}

function setupPluginManager(context: vscode.ExtensionContext) {
    const ALLOWED_PLUGINS_KEY = "allowedPlugins";
    const allowPluginPermanently = async (id: string) => {
        logDebug("Allowing plugin permanently", id);
        const allowedPlugins = context.globalState.get<string[]>(
            ALLOWED_PLUGINS_KEY,
            []
        );
        return context.globalState.update(
            ALLOWED_PLUGINS_KEY,
            arrayUnique([...allowedPlugins, id])
        );
    };
    const allowedPlugins = context.globalState.get<string[]>(
        ALLOWED_PLUGINS_KEY,
        []
    );
    logDebug("Allowed plugins", allowedPlugins);
    Container.set(
        PluginManager,
        new PluginManager(allowPluginPermanently, allowedPlugins)
    );
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

    return { ...api };
}
