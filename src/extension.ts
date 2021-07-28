// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ViewImageService from './ViewImageService';
import ViewPlotService from './ViewPlotService';
import ViewTensorService from './ViewTensorService';
import { tmpdir } from 'os';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { UserSelection } from './PythonSelection';
import { pythonVariablesService } from './PythonVariablesService';
import { VariableWatchTreeProvider, VariableItem, VariableWatcher } from './VariableWatcher';
import { pythonInContextExecutor } from './PythonInContextExecutor';

let viewImageSrv: ViewImageService;
let viewPlotSrv: ViewPlotService;
let viewTensorSrv: ViewTensorService;
let variableWatcherSrv: VariableWatcher;
let variableWatchTreeProvider: VariableWatchTreeProvider;

let services: IStackWatcher[] = [];

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
	viewImageSrv = new ViewImageService(dir);
	viewPlotSrv = new ViewPlotService(dir);
	viewTensorSrv = new ViewTensorService(dir);

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

	variableWatcherSrv = new VariableWatcher([viewImageSrv]);
	variableWatchTreeProvider = new VariableWatchTreeProvider(variableWatcherSrv);

	// register watcher for the debugging session. used to identify the running-frame,
	// so multi-thread will work
	// inspired from https://github.com/microsoft/vscode/issues/30810#issuecomment-590099482
	vscode.debug.registerDebugAdapterTrackerFactory("python", {
		createDebugAdapterTracker: _ => {
			return {
				onWillStartSession: () => {
					variableWatcherSrv.activate();
				},

				onWillStopSession: () => {
					variableWatcherSrv.deactivate();
					variableWatchTreeProvider.refresh();
				},

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
						for (const service of services) {
							service.setFrameId(currentFrame);
						}
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
						// just in case it wasn't set earlier for some reason
						variableWatcherSrv.activate();

						const currentThread = m.body.threadId;
						for (const service of services) {
							service.setThreadId(currentThread);
						}

						const updateWatchView = () => {
							variableWatcherSrv.refreshVariablesAndWatches().then(() => variableWatchTreeProvider.refresh()).catch();
						}
						// workaround for the debugger does not set the variables before it stops,
						// so we'll retry until it works
						if (!variableWatcherSrv.hasInfo) {
							const tryRefresh = () => {
								setTimeout(
									async () => {
										if (!variableWatcherSrv.hasInfo) {
											await updateWatchView();
											tryRefresh();
										}
										else {
											variableWatchTreeProvider.refresh();
										}
									}, 500
								)
							};
							tryRefresh();
						}
						else {
							updateWatchView();
						}
					}
				},
			};
		},
	});

	// init services
	services.push(pythonVariablesService());
	services.push(pythonInContextExecutor());

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('python',
			new PythonViewImageProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.Empty] })
	);

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('pythonDebugImageWatch', variableWatchTreeProvider)
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("svifpd.view-image", async (editor, _, userSelection?: UserSelection) => {

			userSelection ?? (userSelection = await pythonVariablesService().userSelection(editor.document, editor.selection));
			if (userSelection === undefined) {
				return;
			}

			let path = await viewImageSrv.save(userSelection);
			if (path === undefined) {
				return;
			}
			vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path), vscode.ViewColumn.Beside);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("svifpd.view-plot", async (editor, _, userSelection?: UserSelection) => {

			userSelection ?? (userSelection = await pythonVariablesService().userSelection(editor.document, editor.selection));
			if (userSelection === undefined) {
				return;
			}

			let path = await viewPlotSrv.save(userSelection);
			if (path === undefined) {
				return;
			}
			vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path), vscode.ViewColumn.Beside);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("svifpd.view-tensor", async (editor, _, userSelection?: UserSelection) => {

			userSelection ?? (userSelection = await pythonVariablesService().userSelection(editor.document, editor.selection));
			if (userSelection === undefined) {
				return;
			}

			let path = await viewTensorSrv.save(userSelection);
			if (path === undefined) {
				return;
			}
			vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path), vscode.ViewColumn.Beside);
		})
	);

	// image watch command
	context.subscriptions.push(
		vscode.commands.registerCommand("svifpd.watch-view", async (watchVariable: VariableItem) => {

			console.log(watchVariable)

			let path = await watchVariable.viewService.save({ variable: watchVariable.evaluateName }, watchVariable.path);
			if (path === undefined) {
				return;
			}
			vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path), vscode.ViewColumn.Beside);
		})
	);

	// image watch track commands
	context.subscriptions.push(
		vscode.commands.registerCommand("svifpd.watch-track-enable", async (watchVariable: VariableItem) => {
			watchVariable.setTracked();
			variableWatchTreeProvider.refresh();
		})
	);


	context.subscriptions.push(
		vscode.commands.registerCommand("svifpd.watch-track-disable", async (watchVariable: VariableItem) => {
			watchVariable.setNonTracked();
			variableWatchTreeProvider.refresh();
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

		const userSelection = await pythonVariablesService().userSelection(document, range);
		if (userSelection === undefined) {
			return;
		}

		const [isAnImage, _] = await viewImageSrv.isAnImage(userSelection);
		if (isAnImage) {
			return [
				{ command: "svifpd.view-image", title: 'View Image', arguments: [userSelection] }
			];
		}

		const [isAPlot, plotType] = await viewPlotSrv.isAPlot(userSelection);
		if (isAPlot) {
			return [
				{ command: "svifpd.view-plot", title: `View Plot (${plotType})`, arguments: [userSelection] }
			];
		}

		const [isATensor, tensorType] = await viewTensorSrv.isATensor(userSelection);
		if (isATensor) {
			return [
				{ command: "svifpd.view-tensor", title: `View Tensor (${tensorType})`, arguments: [userSelection] }
			];
		}

		return undefined;
	}
}

