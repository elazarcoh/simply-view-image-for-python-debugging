import * as vscode from 'vscode';
import { Api } from './api';

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
		'columns': str(list(obj.columns)),
	}
def pandas_dataframe_save(path, obj):
	obj.to_csv(path, index=False)
`;
export async function activate(context: vscode.ExtensionContext) {

	const dep = vscode.extensions.getExtension('elazarcoh.simply-view-image-for-python-debugging')
	if (dep === undefined) {
		vscode.window.showErrorMessage('Plugin Example requires the Simply View Image extension to be installed.')
		return;
	}

	const api = await dep.activate() as Api;
	if (api === undefined) {
		vscode.window.showErrorMessage('Failed to activate Simply View Image extension.')
		return;
	}

	const m = api.atModule;
	try {

		const result = await api.registerView({
			extensionId: 'example-plugin',
			group: 'CSV',
			type: 'pandas.DataFrame',
			title: 'CSV',
			setupPythonCode: {
				setupCode: () => PANDAS_CSV_CODE,
				testSetupCode: 'is_pandas_dataframe, pandas_dataframe_info, pandas_dataframe_save',
			},
			testTypePythonCode: {
				evalCode: (expression: string) => `${m("is_pandas_dataframe")}(${expression})`,
			},
			infoPythonCode: {
				evalCode: (expression: string) => `${m("pandas_dataframe_info")}(${expression})`,
			},
			serializeObjectPythonCode: {
				evalCode: (expression: string, savePath: string) => `${m("pandas_dataframe_save")}('${savePath}', ${expression})`,
			},
		});

		if (!result) {
			vscode.window.showErrorMessage('Failed to register view.');
			return;
		}
	}
	catch (err) {
		vscode.window.showErrorMessage('Failed to register view: ' + err);
		return;
	}


}

// This method is called when your extension is deactivated
export function deactivate() { }
