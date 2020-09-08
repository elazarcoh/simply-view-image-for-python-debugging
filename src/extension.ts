// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ViewImageService, { validateConfig } from './ViewImageService';
import { isAnImage } from './ViewImageService';
import { tmpdir } from 'os';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ImageViewConfig, backends, normalizationMethods } from './types';
import { stringToEnumValue } from './utils';

let viewImageSvc: ViewImageService;

const WORKING_DIR = 'svifpd';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let usetmp = vscode.workspace.getConfiguration("svifpd").get("useTmpPathToSave", true);
	let dir = context.storagePath as string;
	if (usetmp || dir === undefined) {
		dir = tmpdir();
		dir = join(dir, WORKING_DIR);
	}

	if (existsSync(dir)) {
		let files = readdirSync(dir);
		files.forEach(file => {
			let curPath = join(dir, file);
			unlinkSync(curPath);
		});
	}
	else {
		mkdirSync(dir);
	}

	viewImageSvc = new ViewImageService(dir);

	console.log('Congratulations, your extension "simply-view-image-for-python-debugging" is now active!');

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('python',
			new PythonViewImageProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.Empty] })
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("extension.viewimagepythondebug", async editor => {
			const preferredBackend = vscode.workspace.getConfiguration("svifpd").get("preferredBackend", backends.Standalone);
			const normalizationMethod = vscode.workspace.getConfiguration("svifpd").get("normalizationMethod", normalizationMethods.normalize);
			const config: ImageViewConfig = {
				//@ts-ignore we know it must return a value because preferredBackend is set with default
				preferredBackend: stringToEnumValue(backends, preferredBackend),
				//@ts-ignore we know it must return a value because normalizationMethod is set with default
				normalizationMethod: stringToEnumValue(normalizationMethods, normalizationMethod),
			};
			const configValid = await validateConfig(config);
			if(!configValid)
			{
				return;
			}
			let path = await viewImageSvc.ViewImage(editor.document, editor.selection, config);
			if (path === undefined) {
				return;
			}
			vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path), vscode.ViewColumn.Beside);
		})
	);

}

// this method is called when your extension is deactivated
export function deactivate() { }


/**
 * Provides code actions for python opencv image.
 */
export class PythonViewImageProvider implements vscode.CodeActionProvider {

	public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.Command[] | undefined> {
		if (vscode.debug.activeDebugSession === undefined) {
			return undefined;
		}
		const valid = await isAnImage(document, range);
		if (!valid) {
			return undefined;
		}

		return [
			{ command: "extension.viewimagepythondebug", title: 'View Image' }
		];
	}
}

