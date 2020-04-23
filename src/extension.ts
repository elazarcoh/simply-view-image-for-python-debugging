// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { join } from 'path';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';

const WORKING_DIR = 'svifpod';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "simply-view-image-for-python-opencv-debugging" is now active!');

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('python', 
		new PythonOpencvImageProvider(), {	providedCodeActionKinds: [vscode.CodeActionKind.Empty] }));

}

// this method is called when your extension is deactivated
export function deactivate() {}


/**
 * Provides code actions for python opencv image.
 */
export class PythonOpencvImageProvider implements vscode.CodeActionProvider {

	private workingdir :string;
	
	public constructor()
	{
		let dir = tmpdir();
		dir = join(dir, WORKING_DIR);
		if (existsSync(dir))
		{
			let files = readdirSync(dir);
			files.forEach(file => {
				let curPath = join(dir, file);
				unlinkSync(curPath);
			});
		}
		else
		{
			mkdirSync(dir);
		}

		this.workingdir = dir;
	}

	public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.Command[] | undefined> {
		const session = vscode.debug.activeDebugSession;
		if (session === undefined) {
			return;
		}

		const variable = document.getText(document.getWordRangeAtPosition(range.start));
		let path = join(this.workingdir,  `${variable}.png`);
		let savepath = path.replace(/\\/g, '/');
		let response = await session.customRequest('stackTrace', { threadId: 1 });
		const frameId = response.stackFrames[0].id;
		const expression = `cv2.imwrite('${savepath}', ${variable})`;
		response = await session.customRequest("evaluate", { expression: expression, frameId: frameId });
		console.log(`evaluate ${expression} result: ${response.result}`);

		return [
			{ command:"vscode.open", title: 'View Image', arguments: [vscode.Uri.file(path), vscode.ViewColumn.Beside ] }
		];
	}
}