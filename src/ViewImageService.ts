import * as vscode from 'vscode';
import { join } from 'path';

export default class ViewImageService {
	private workingdir :string;

	public constructor(dir: string)
	{
		this.workingdir = dir;
	}

	public async ViewImage(document: vscode.TextDocument, range: vscode.Range): Promise<string|undefined> {
		const session = vscode.debug.activeDebugSession;
		if (session === undefined) {
			return;
		}

		let res = await session.customRequest('threads', {});
		let threads = res.threads;
		let mainThread = threads[0].id;

		res = await session.customRequest('stackTrace', { threadId: mainThread });
		let stacks = res.stackFrames;
		let callStack = stacks[0].id;

		res = await session.customRequest('scopes', {frameId: callStack});
		let scopes = res.scopes;
		let local = scopes[0];

		res = await session.customRequest('variables', { variablesReference: local.variablesReference });
		let variables: any[] = res.variables;

		const selectedVariable = document.getText(document.getWordRangeAtPosition(range.start));

		let targetVariable = variables.find( v => v.name === selectedVariable);
		if (targetVariable === undefined)
		{
			return;
		}

		let path = join(this.workingdir,  `${targetVariable.name}.png`);
		let savepath = path.replace(/\\/g, '/');

		const vn = targetVariable.evaluateName; // var name
		const float_expression =  `${vn} * 255.0 if (isinstance(${vn}, (np.ndarray)) and (${vn}.dtype == np.float64 or ${vn}.dtype == np.float32)) else ${vn}`;
		const expression = `cv2.imwrite('${savepath}', ${float_expression})`;
		res = await session.customRequest("evaluate", { expression: expression, frameId: callStack, context:'hover' });
		console.log(`evaluate ${expression} result: ${res.result}`);

		return path;
	}
}