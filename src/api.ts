import * as vscode from "vscode";
import { Viewable } from "./viewable/Viewable";
import { logDebug, logInfo } from "./Logging";
import Container, { Service } from "typedi";
import { atModule as atModule_ } from "./python-communication/BuildPythonCode";
import { getConfiguration } from "./config";
import { AllViewables } from "./AllViewables";
import { setSetupIsNotOkay } from "./python-communication/Setup";

interface PluginViewable extends Viewable {
    extensionId: string;
}
@Service()
export class PluginManager implements vscode.Disposable {
    private readonly _allowedPlugins: string[] = [];
    private readonly _plugins: PluginViewable[] = [];
    private readonly _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _allowPluginPermanently: (
            id: string
        ) => Promise<unknown>,
        allowedPlugins: readonly string[] = []
    ) {
        this._allowedPlugins.push(...allowedPlugins);
    }

    public allowPlugin(id: string): void {
        if (this.isPluginAllowed(id)) {
            return;
        }
        this._allowedPlugins.push(id);
    }

    public async allowPluginPermanently(id: string): Promise<void> {
        await this._allowPluginPermanently(id);
        this.allowPlugin(id);
    }

    public isPluginAllowed(id: string): boolean {
        return this._allowedPlugins.includes(id);
    }

    public addPlugin(
        plug: PluginViewable,
        pluginDisposable: vscode.Disposable
    ): void {
        if (this.isPluginAllowed(plug.extensionId)) {
            this._plugins.push(plug);
            this._disposables.push(pluginDisposable);
        }
    }

    public disablePlugin(plug: PluginViewable): void {
        const index = this._plugins.indexOf(plug);
        if (index > -1) {
            this._plugins.splice(index, 1);
        }
        const disposable = this._disposables[index];
        if (disposable !== undefined) {
            disposable.dispose();
            this._disposables.splice(index, 1);
        }
    }

    get plugins(): readonly PluginViewable[] {
        return this._plugins;
    }

    public dispose(): void {
        this._disposables.forEach((d) => d.dispose());
    }
}

export async function disablePluginCommand() {
    const pluginManager = Container.get(PluginManager);
    const pick = await vscode.window.showQuickPick(
        pluginManager.plugins.map((p) => ({
            label: p.title,
            detail: `(by ${p.extensionId})`,
            plugin: p,
        })),
        {
            canPickMany: true,
            title: "Select plugins to disable",
        }
    );
    if (pick === undefined || pick.length === 0) {
        return;
    }
    for (const p of pick) {
        pluginManager.disablePlugin(p.plugin);
    }
    setSetupIsNotOkay();
}

async function askUserToAllowPlugin<T extends string>(
    plug: PluginViewable,
    ...options: T[]
): Promise<T | undefined> {
    return vscode.window.showInformationMessage(
        `A plugin has asked to register a view: ${plug.extensionId}.` +
            `It allows you to view ${plug.title} objects.` +
            `Ignore this message would not activate this plugin.`,
        ...options
    );
}

enum EnablePluginResponse {
    OkayDoNotShowAgain = "Okay, Do not show again",
    OkayUntilRestart = "Okay (until restart)",
    ViewCode = "View Code",
    DisablePlugin = "Disable Plugin",
}

type RegisterResult =
    | {
          success: true;
          disposable: vscode.Disposable;
      }
    | {
          success: false;
      };

function addPluginToViewables(plug: PluginViewable) {
    const viewable = Container.get(AllViewables).addViewable(plug);
    if (viewable === undefined) {
        return;
    }
    Container.get(PluginManager).addPlugin(plug, viewable);
    return {
        success: true,
        disposable: viewable,
    };
}

async function registerView(plug: PluginViewable): Promise<RegisterResult> {
    if (getConfiguration("allowPlugins", undefined, true) === false) {
        return { success: false };
    }
    const pluginManager = Container.get(PluginManager);

    if (pluginManager.isPluginAllowed(plug.extensionId)) {
        logDebug("Plugin is allowed", plug);
        return addPluginToViewables(plug) ?? { success: false };
    }

    logInfo("Registering view", plug);

    let response = await askUserToAllowPlugin(
        plug,
        EnablePluginResponse.OkayDoNotShowAgain,
        EnablePluginResponse.OkayUntilRestart,
        EnablePluginResponse.ViewCode,
        EnablePluginResponse.DisablePlugin
    );

    if (
        response === undefined ||
        response === EnablePluginResponse.DisablePlugin
    ) {
        return { success: false };
    }
    if (response === EnablePluginResponse.ViewCode) {
        response = await showPluginCode(plug);
    }
    if (response === EnablePluginResponse.OkayDoNotShowAgain) {
        pluginManager.allowPluginPermanently(plug.extensionId);
    } else if (response === EnablePluginResponse.OkayUntilRestart) {
        pluginManager.allowPlugin(plug.extensionId);
    } else {
        return { success: false };
    }

    logDebug("Registering view", plug);
    return addPluginToViewables(plug) ?? { success: false };
}

async function showPluginCode(
    plug: PluginViewable
): Promise<EnablePluginResponse | undefined> {
    const fileName = `plugin-${plug.extensionId}.py`;
    const newUri = vscode.Uri.file(fileName).with({
        scheme: "untitled",
        path: fileName,
    });

    const document = await vscode.workspace.openTextDocument(newUri);
    const textEdit = await vscode.window.showTextDocument(document);
    const header = (h: string) =>
        "#".repeat(h.length + 4) +
        "\n" +
        `# ${h} #\n` +
        "#".repeat(h.length + 4);
    await textEdit.edit((edit) =>
        edit.insert(
            new vscode.Position(0, 0),
            [
                header(`Plugin ${plug.extensionId}`),
                "",
                header("Setup Code"),
                plug.setupPythonCode.setupCode(),
                "",
                header("Test Setup Code"),
                plug.setupPythonCode.testSetupCode,
                "",
                header("Test Object Type Code"),
                plug.testTypePythonCode.evalCode("x") +
                    "  # x is some variable from your code",
                "",
                header("Retrieve Information Code"),
                plug.infoPythonCode.evalCode("x") +
                    "  # x is some variable from your code",
                "",
                header("Save Object Code"),
                plug.serializeObjectPythonCode.evalCode("x", "path") +
                    "  # x is some variable from your code, path is the path to save the object to",
                "",
            ].join("\n")
        )
    );
    return askUserToAllowPlugin(
        plug,
        EnablePluginResponse.OkayDoNotShowAgain,
        EnablePluginResponse.OkayUntilRestart,
        EnablePluginResponse.DisablePlugin
    );
}

function atModule(name: string) {
    return atModule_(name);
}

function catchErrorsIntoPromise<T, Args extends unknown[]>(
    func: (...args: Args) => T
): (...args: Args) => Promise<T> {
    return async (...args: Args) => {
        try {
            return Promise.resolve(await func(...args));
        } catch (err) {
            return Promise.reject(err);
        }
    };
}

export const api = {
    registerView: catchErrorsIntoPromise(registerView),
    atModule,
};
