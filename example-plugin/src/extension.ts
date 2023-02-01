import * as vscode from "vscode";
import { Api } from "./api";

const PANDAS_CSV_CODE = `
import pandas as pd
def is_pandas_dataframe(obj):
	try:
		return isinstance(obj, pd.DataFrame)
	except:
		return False
def pandas_dataframe_info(obj):
	return {
		'num_rows': str(len(obj)),
		'num_columns': str(len(obj.columns)),
		'columns': ", ".join(map(str, obj.columns)),
	}
def pandas_dataframe_save(path, obj):
	obj.to_csv(path, index=False)
`;
export async function activate(context: vscode.ExtensionContext) {
    const dep = vscode.extensions.getExtension(
        "elazarcoh.simply-view-image-for-python-debugging"
    );
    if (dep === undefined) {
        vscode.window.showErrorMessage(
            "Plugin Example requires the Simply View Image extension to be installed."
        );
        return;
    }

    const api = (await dep.activate()) as Api;
    if (api === undefined) {
        vscode.window.showErrorMessage(
            "Failed to activate Simply View Image extension."
        );
        return;
    }

    const m = api.atModule;
    try {
        const result = await api.registerView({
            // Extension id to be presented to the user
            extensionId: "example-plugin",
            // The group of the view. This is used to group multiple types of
            // viewable objects together, e.g. numpy and PIL images.
            // They will share the same button in the tree-view.
            // Note that you need to add the command for the group in `package.json`.
            // You do not need to register the command, it is done automatically by the API.
            // In this case, we added the following entries to `package.json`:
            // "contributes": {
            //     "commands": [
            //         {
            //             "command": "svifpd.watch-view-table",
            //             "title": "View Image",
            //             "enablement": "inDebugMode",
            //             "icon": "$(table)"
            //         }
            //     ],
            //     "menus": {
            //         "commandPalette": [
            //             {
            //                 "command": "svifpd.watch-view-table",
            //                 "when": "false"
            //             }
            //         ],
            //         "view/item/context": [
            //             {
            //                 "command": "svifpd.watch-view-table",
            //                 "when": "view == pythonDebugImageWatch && viewItem =~ /svifpd:nonTrackedVariable-.*?table.*/ || view == pythonDebugImageWatch && viewItem =~ /svifpd:trackedVariable-.*?table.*/",
            //                 "group": "inline@11"
            //             }
            //         ]
            //     }
            // }
            group: "table",
            // `type` is used to identify the viewable object.
            type: "pandas.DataFrame",
            // The title of the view, as it will be presented to the user.
            title: "CSV",
            // Code to be executed to setup the environment.
            // Probably you will want to import the relevant libraries,
            // and define functions to check if the object is of the correct type,
            // and to get information about the object, and to save it.
            setupPythonCode: {
                setupCode: () => PANDAS_CSV_CODE,
                // Code to test if the environment was setup correctly.
                testSetupCode:
                    "is_pandas_dataframe, pandas_dataframe_info, pandas_dataframe_save",
            },
            // Code to be executed to test if the object is of the correct type.
            testTypePythonCode: {
                evalCode: (expression: string) =>
                    `${m("is_pandas_dataframe")}(${expression})`,
            },
            // Code to be executed to get information about the object.
            infoPythonCode: {
                evalCode: (expression: string) =>
                    `${m("pandas_dataframe_info")}(${expression})`,
            },
            // Code to be executed to save the object.
            // The code should expect 2 arguments: the path to save to, and the object.
            serializeObjectPythonCode: {
                evalCode: (expression: string, savePath: string) =>
                    `${m(
                        "pandas_dataframe_save"
                    )}('${savePath}', ${expression})`,
            },
            // Suffix to be used for the saved file.
            suffix: ".csv",
            // Optionally, you can provide a custom function to show the saved file.
            onShow: async (path: string) => {
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path));
                await vscode.window.showInformationMessage(`Saved to ${path}`);
            },
        });

        if (result.success === false) {
            vscode.window.showErrorMessage("Failed to register view.");
            return;
        } else {
            context.subscriptions.push(result.disposable);
        }
    } catch (err) {
        vscode.window.showErrorMessage("Failed to register view: " + err);
        return;
    }
}

// This method is called when your extension is deactivated
export function deactivate() { }
