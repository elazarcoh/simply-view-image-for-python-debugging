import * as vscode from 'vscode';
import { join } from 'path';

export default class ViewImageService {

	static readonly define_writer_expression: string = `
from types import ModuleType
__python_view_image_mod = ModuleType('python_view_image_mod', '')

exec(
'''
import importlib
def try_import(package):
    try:
        return importlib.import_module(package)
    except ImportError:
        return None

def prepare_image(img, preprocess_method='normalize'):
    import numpy as np
    img = np.array(img)
    if preprocess_method == 'skimage.img_as_ubyte':
        from skimage import img_as_ubyte
        try:
            return img_as_ubyte(img)
        except:
            return prepare_image(img)
    elif preprocess_method == 'normalize':
        img = img - img.min()
        img = img / img.max()
        img = img * 255
        img = img.astype(np.uint8)
        return img
    else:
        return img

def cv2_imsave(path, img):
    import cv2
    cv2.imwrite(path, img)

def skimage_imsave(path, img):
    import skimage.io
    skimage.io.imsave(path, img)

options = [
    ('skimage.io', skimage_imsave),
    ('cv2', cv2_imsave),
]
save_function = None
for module_name, function in options:
    module = try_import(module_name)
    if module:
        save_function = function
        break
'''
, __python_view_image_mod.__dict__
)
`;

	private workingdir: string;

	public constructor(dir: string) {
		this.workingdir = dir;
	}

	public async ViewImage(document: vscode.TextDocument, range: vscode.Range): Promise<string | undefined> {
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

		res = await session.customRequest('scopes', { frameId: callStack });
		let scopes = res.scopes;
		let local = scopes[0];

		res = await session.customRequest('variables', { variablesReference: local.variablesReference });
		let variables: any[] = res.variables;

		let selected = document.getText(range);

		const selectedVariable = document.getText(document.getWordRangeAtPosition(range.start));
		let targetVariable = variables.find(v => v.name === selectedVariable);

		let filename = undefined;
		let vn : string = "";
		let path = undefined;
		if (selected !== "") {
			const tmp = require('tmp');
			const options = { postfix: ".png", dir: this.workingdir };
			path = tmp.tmpNameSync(options);
			vn = selected;
		} else if (targetVariable !== undefined) {
			path = join(this.workingdir, `${targetVariable.name}.png`);
			vn = targetVariable.evaluateName; // var name
		} else {
			return;
		}

		const savepath = path.replace(/\\/g, '/');

		const expression = (
			`
exec(\"\"\"
${ViewImageService.define_writer_expression}
__python_view_image_mod.save_function('${savepath}',  __python_view_image_mod.prepare_image(${vn}, "skimage.img_as_ubyte"))
\"\"\"
)
`
		);
		res = await session.customRequest("evaluate", { expression: expression, frameId: callStack, context: 'hover' })
			.then(undefined, error => {
				console.log(error);
				vscode.window.showErrorMessage(`could not show image for "${vn}". please check log.`)
			});
		console.log(`evaluate ${expression} result: ${res.result}`);

		return path;
	}
}