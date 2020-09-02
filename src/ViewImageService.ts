import * as vscode from 'vscode';
import { join } from 'path';
import { ImageViewConfig } from './types';

export default class ViewImageService {

	// define all the needed stuff in python.
	// keeps it in __python_view_image_mod variable to minimize the namespace pollution as much as possible
	static readonly define_writer_expression: string = `
try:
    __python_view_image_mod
except NameError:
    
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

options = {
    'skimage.io': skimage_imsave,
    'cv2': cv2_imsave,
}

def get_function(preferred=None):
    save_function = None
    
    if preferred is not None:
        module = try_import(preferred)
        if module:
            return options[preferred]    
    
    for module_name, function in options.items():
        module = try_import(module_name)
        if module:
            save_function = function
            break
    return save_function

def save(path, img, backend, preprocess):
    func = get_function(backend)
    img = prepare_image(img, preprocess)
    func(path, img)
'''
    , __python_view_image_mod.__dict__
    )
`;

	private workingdir: string;

	public constructor(dir: string) {
		this.workingdir = dir;
	}

	public async ViewImage(document: vscode.TextDocument, range: vscode.Range, config: ImageViewConfig): Promise<string | undefined> {
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

		let vn: string = "";
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

		const py_save_path = path.replace(/\\/g, '/');

		const expression = (
			`
exec(\"\"\"
${ViewImageService.define_writer_expression}
__python_view_image_mod.save("${py_save_path}", ${vn}, backend="${config.preferredBackend}", preprocess="${config.normalizationMethod}")
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