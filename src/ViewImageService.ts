import * as vscode from 'vscode';
import { join } from 'path';
import { ImageViewConfig, backends, normalizationMethods } from './types';

export default class ViewImageService {

    // define all the needed stuff in python.
    // keeps it in _python_view_image_mod variable to minimize the namespace pollution as much as possible
    static readonly py_module = '_python_view_image_mod';
    static readonly np = '_python_view_image_mod.np';
    static readonly define_writer_expression: string = `
try:
    _python_view_image_mod
except NameError:
    
    from types import ModuleType
    _python_view_image_mod = ModuleType('python_view_image_mod', '')

    exec(
'''
import numpy as np
def standalone_imsave(path, img):
    def preprocess_for_png(img):
        assert img.ndim >= 2 and img.ndim <= 3
        has_alpha = img.ndim == 3 and img.shape[2] == 4
        is_grayscale = img.ndim == 2 or (img.shape[2] == 1)

        while img.ndim < 3:
            img = img[..., None]
        
        if is_grayscale:
            img = np.concatenate((img, img, img), axis=2)
        if not has_alpha:
            mask = np.full((*img.shape[:2], 1), 0xFF)
            img = np.concatenate((img, mask), axis=2)

        return img.astype(np.ubyte)

    # https://gist.github.com/campagnola/0fb74586d38ea1a86e99
    def make_png(data):
        import numpy as np
        import zlib
        import struct

        assert data.dtype == np.ubyte
        assert data.ndim == 3
        assert data.shape[-1] == 4

        # www.libpng.org/pub/png/spec/1.2/PNG-Structure.html
        header = bytes.fromhex('89504e470d0a1a0a') # header

        def mkchunk(data, name):
            if isinstance(data, np.ndarray):
                size = data.nbytes
            else:
                size = len(data)
            chunk = np.empty(size + 12, dtype=np.ubyte)
            chunk.data[0:4] = struct.pack('!I', size)
            chunk.data[4:8] = name # b'CPXS' # critical, public, standard, safe
            chunk.data[8:8+size] = data
            chunk.data[-4:] = struct.pack('!I', zlib.crc32(chunk[4:-4]))
            return chunk

        # www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.IHDR
        ctyp = 0b0110  # alpha, color
        h, w = data.shape[:2]
        depth = data.itemsize * 8
        ihdr = struct.pack('!IIBBBBB', w, h, depth, ctyp, 0, 0, 0)
        c1 = mkchunk(ihdr, b'IHDR')

        # www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.IDAT
        idat = np.empty((h, w*4 + 1), dtype=np.ubyte) # insert filter byte at each scanline
        idat[:, 1:] = data.reshape(h, w*4)
        idat[:, 0] = 0
        c2 = mkchunk(zlib.compress(idat), b'IDAT')

        c3 = mkchunk(np.empty((0,), dtype=np.ubyte), b'IEND')

        # concatenate
        lh = len(header)
        png = np.empty(lh + c1.nbytes + c2.nbytes + c3.nbytes, dtype=np.ubyte)
        png.data[:lh] = header
        p = lh
        for chunk in (c1, c2, c3):
            png[p:p+len(chunk)] = chunk
            p += chunk.nbytes

        return png

    with open(path, 'wb')as fp:
        fp.write(make_png(preprocess_for_png(img)))

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

def opencv_imsave(path, img):
    import cv2
    cv2.imwrite(path, img)

def skimage_imsave(path, img):
    import skimage.io
    skimage.io.imsave(path, img)

def imageio_imsave(path, img):
    import imageio
    imageio.imwrite(path, img)

def pillow_imsave(path, img):
    from PIL import Image
    img = Image.fromarray(img)
    img.save(path)

options = {
    'skimage': ('skimage.io', skimage_imsave),
    'opencv': ('cv2', opencv_imsave),
    'imageio': ('imageio', imageio_imsave),
    'Pillow' : ('PIL', pillow_imsave),
    'Standalone' : ('numpy', standalone_imsave)
}

def get_function(preferred=None):
    save_function = None
    
    if preferred is not None and preferred in options:
        module_test, function = options[preferred] 
        module = try_import(module_test)
        if module:
            return function
    
    for name, (module_test, function) in options.items():
        module = try_import(module_test)
        if module:
            save_function = function
            break
    return save_function

def save(path, img, backend, preprocess):
    func = get_function(backend)
    img = prepare_image(img, preprocess)
    func(path, img)
'''
    , _python_view_image_mod.__dict__
    )
`;

    public constructor(
        private readonly workingDir: string,
    ) { }

    public setThreadId(threadId: number) {
        this.threadId = threadId;
    }
    public setFrameId(frameId: number) {
        this.frameId = frameId;
    }

    private threadId: number = 0;
    private frameId: number = 0;

    private currentIdx: number = 0;

    private get currentImgIdx(): number {
        this.currentIdx = (this.currentIdx + 1) % 10;
        return this.currentIdx;
    }

    public async ViewImage(document: vscode.TextDocument, range: vscode.Range, config: ImageViewConfig): Promise<string | undefined> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }

        let variables = await this.localVariables(session);

        let selected = document.getText(range);

        const selectedVariable = document.getText(document.getWordRangeAtPosition(range.start));
        let targetVariable = variables.find(v => v.name === selectedVariable);

        let vn: string = "";
        let path = undefined;
        if (selected !== "") {
            const tmp = require('tmp');
            const options = { postfix: ".png", dir: this.workingDir };
            path = tmp.tmpNameSync(options);
            vn = selected;
        } else if (targetVariable !== undefined) {
            path = join(this.workingDir, `${targetVariable.name}(${this.currentImgIdx}).png`);
            vn = targetVariable.evaluateName; // var name
        } else {
            return;
        }

        const py_save_path = path.replace(/\\/g, '/');

        const expression = (
            `
exec(\"\"\"
${ViewImageService.define_writer_expression}
_python_view_image_mod.save("${py_save_path}", ${vn}, backend="${config.preferredBackend}", preprocess="${config.normalizationMethod}")
\"\"\"
)
`
        );

        try {
            const res = await this.evaluate(session, expression);
            console.log(`evaluate ${expression} result: ${res.result}`);
        } catch (error) {
            console.log(error);
            vscode.window.showErrorMessage(`could not show image for "${vn}". please check log.`);
            return;
        }

        return path;
    }

    private async localVariables(session: vscode.DebugSession): Promise<any[]> {
        let res = await session.customRequest('scopes', { frameId: this.frameId });
        let scopes = res.scopes;
        let local = scopes[0];

        res = await session.customRequest('variables', { variablesReference: local.variablesReference });
        let variables: any[] = res.variables;

        return variables;
    }

    async isAnImage(document: vscode.TextDocument, range: vscode.Range): Promise<boolean> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return false;
        }

        let variables = await this.localVariables(session);

        let selected = document.getText(range);

        const selectedVariable = document.getText(document.getWordRangeAtPosition(range.start));
        let targetVariable = variables.find(v => v.name === selectedVariable);

        let vn: string = "";
        if (selected !== "") {
            vn = selected;
        } else if (targetVariable !== undefined) {
            vn = targetVariable.evaluateName; // var name
        } else {
            return false;
        }

        // test if evaluated to numpy array legal image

        try {
            const initExpression = (
                `
exec(\"\"\"
${ViewImageService.define_writer_expression}
\"\"\"
)
`
            );
            const res = await this.evaluate(session, initExpression);
            console.log(`evaluate initExpression result: ${res.result}`);
        } catch (error) {
            console.log(error);
            return false;
        }

        try {
            const np = ViewImageService.np;
            const expression = (`(${np}.array(${vn}).ndim == 2) or (${np}.array(${vn}).ndim == 3 and ${np}.array(${vn}).shape[2] in (1, 3, 4))`);
            const res = await this.evaluate(session, expression);
            console.log(`evaluate expression result: ${res.result}`);
            if (res.result === "True") {
                return true;
            }
        } catch (error) {
            console.log(error);
            return false;
        }

        return false;
    }

    async validateConfig(config: ImageViewConfig): Promise<boolean> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return false;
        }

        // add testing expression for each relevant configuration
        const validationExpressions = [];

        if (config.normalizationMethod === normalizationMethods.skimage_img_as_ubyte) {
            // we need to validate skimage is avaliable
            const testExpression = (
                `
exec(
'''
try:
    import skimage
except ImportError:
    pass
''', _python_view_image_tmp_mod.__dict__)
`
            );
            validationExpressions.push({
                test: testExpression,
                validate: `'skimage' in _python_view_image_tmp_mod.__dict__`,
                message: "skimage could not be imported. try to change the normalization method at the settings to 'normalize'",
                isError: true,
            })
        }

        { // test preferredBackend
            let needToBeImported: string;
            switch (config.preferredBackend) {
                case backends.Pillow:
                    needToBeImported = "PIL"
                    break;
                case backends.imageio:
                    needToBeImported = "imageio"
                    break;
                case backends.opencv:
                    needToBeImported = "cv2"
                    break;
                case backends.skimage:
                    needToBeImported = "skimage"
                    break;
                case backends.Standalone:
                default:
                    needToBeImported = "numpy"
                    break;
            }
            const testExpression = (
                `
exec(
'''
try:
    import ${needToBeImported}
except ImportError:
    pass
''', _python_view_image_tmp_mod.__dict__)
`
            );

            const validateExpression = `'${needToBeImported}' in _python_view_image_tmp_mod.__dict__`;
            validationExpressions.push({
                test: testExpression,
                validate: validateExpression,
                message: `preferred backend ${config.preferredBackend} can't be used, as it depends on '${needToBeImported}'. will try to fall back to other method`,
                isError: false,
            })
        }

        const setupExpression = (
            `
exec(\"\"\"
from types import ModuleType
_python_view_image_tmp_mod = ModuleType('_python_view_image_tmp_mod', '')
\"\"\"
)
`
        );

        const cleanupExpression = `exec('del _python_view_image_tmp_mod')`;

        try {
            let res = await this.evaluate(session, setupExpression);
            console.log(`evaluate setupExpression result: ${res.result}`);

            for (const { test, validate, message, isError } of validationExpressions) {
                res = await this.evaluate(session, test);
                console.log(`evaluate test result: ${res.result}`);

                res = await this.evaluate(session, validate);
                console.log(`evaluate validateExpression result: ${res.result}`);
                if (res.result !== "True") {
                    if (isError) {
                        vscode.window.showErrorMessage(message);
                        try {
                            res = await this.evaluate(session, cleanupExpression);
                            console.log(`evaluate cleanupExpression result: ${res.result}`);
                        } catch (error) {
                            console.log(error);
                        }
                        return false;
                    }
                    else {
                        vscode.window.showWarningMessage(message);
                        continue;
                    }
                }
            }
            res = await this.evaluate(session, cleanupExpression);
            console.log(`evaluate cleanupExpression result: ${res.result}`);

        } catch (error) {
            console.log(error);
            await this.evaluate(session, cleanupExpression);
            return false;
        }

        // not fails on any step
        return true;
    }

    private evaluate(session: vscode.DebugSession, expression: string) {
        return session.customRequest("evaluate", { expression: expression, frameId: this.frameId, context: 'hover' });
    }
}
