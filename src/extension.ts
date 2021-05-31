// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ViewImageService from './ViewImageService';
import ViewPlotService from './ViewPlotService';
import { tmpdir } from 'os';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ImageViewConfig, backends, normalizationMethods } from './types';
import { stringToEnumValue } from './utils';

let viewImageSrv: ViewImageService;
let viewPlotSrv: ViewPlotService;

const WORKING_DIR = 'svifpd';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// register watcher for the debugging session. used to identify the running-frame,
	// so multi-thread will work
	// inspired from https://github.com/microsoft/vscode/issues/30810#issuecomment-590099482
	vscode.debug.registerDebugAdapterTrackerFactory("python", {
		createDebugAdapterTracker: _ => {
			return {
				onWillReceiveMessage: async msg => {
					interface ScopesRequest {
						type: "request";
						command: "scopes";
						arguments: {
							frameId: number;
						}
					}
					const m = msg as ScopesRequest;
					if (m.type === "request" && m.command === "scopes") {
						const currentFrame = m.arguments.frameId;
						viewImageSrv.setFrameId(currentFrame);
						viewPlotSrv.setFrameId(currentFrame);
					}
				},
				onDidSendMessage: async msg => {
					interface StoppedEvent {
						type: "event";
						event: "stopped";
						body: {
							threadId: number;
						};
					}
					const m = msg as StoppedEvent;
					if (m.type === "event" && m.event === "stopped") {
						const currentThread = m.body.threadId;
						viewImageSrv.setThreadId(currentThread);
						viewPlotSrv.setThreadId(currentThread);
					}
				},
			};
		},
	});


	let usetmp = vscode.workspace.getConfiguration("svifpd").get("useTmpPathToSave", true);
	let dir = context.storagePath as string;
	if (usetmp || dir === undefined) {
		dir = tmpdir();
		dir = join(dir, WORKING_DIR);
	}
	viewImageSrv = new ViewImageService(dir);
	viewPlotSrv = new ViewPlotService(dir);

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

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('python',
			new PythonViewImageProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.Empty] })
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("svifpd.view-image", async editor => {
			const preferredBackend = vscode.workspace.getConfiguration("svifpd").get("preferredBackend", backends.Standalone);
			const normalizationMethod = vscode.workspace.getConfiguration("svifpd").get("normalizationMethod", normalizationMethods.normalize);
			const config: ImageViewConfig = {
				preferredBackend: stringToEnumValue(backends, preferredBackend)!,
				normalizationMethod: stringToEnumValue(normalizationMethods, normalizationMethod)!,
			};
			const configValid = await viewImageSrv.validateConfig(config);
			if (!configValid) {
				return;
			}
			let path = await viewImageSrv.ViewImage(editor.document, editor.selection, config);
			if (path === undefined) {
				return;
			}
			vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path), vscode.ViewColumn.Beside);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("svifpd.view-plot", async editor => {

			let path = await viewPlotSrv.ViewPlot(editor.document, editor.selection);
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
		const isAnImage = await viewImageSrv.isAnImage(document, range);
		if (isAnImage) {
			return [
				{ command: "svifpd.view-image", title: 'View Image' }
			];
		}
		const [isAPlot, plotType] = await viewPlotSrv.isAPlot(document, range);
		if (isAPlot) {
			return [
				{ command: "svifpd.view-plot", title: `View Plot (${plotType})` }
			];
		}

		return undefined;
	}
}

