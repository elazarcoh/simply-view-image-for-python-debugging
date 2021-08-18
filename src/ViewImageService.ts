import * as vscode from 'vscode';
import { ImageViewConfig, backends, normalizationMethods, currentConfigurations } from './config';
import { isVariableSelection, ScopeVariables, UserSelection, Variable, VariableSelection } from './PythonSelection';
import { VariableInformation, ViewerService } from './ViewerService';

type ImageInformation = {
    type: string,
    shape: string,
    dtype: string,
};

export default class ViewImageService extends ViewerService {

    // define all the needed stuff in python.
    // keeps it in _python_view_image_mod variable to minimize the namespace pollution as much as possible
    static readonly py_module = '_python_view_image_mod';
    static readonly np = '_python_view_image_mod.np';
    static readonly save_func = 'save';
    static readonly check_obj_func = 'is_a';
    static readonly info_func = 'image_info';
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

def ${ViewImageService.save_func}(path, img, backend, preprocess):
    func = get_function(backend)
    img = prepare_image(img, preprocess)
    func(path, img)

def is_pillow_image(img):
    PIL = try_import('PIL')
    if PIL:
        import PIL.Image
        return isinstance(img, PIL.Image.Image)
    else:
        return False
def is_numpy_image(img):
    return isinstance(img, np.ndarray)
restricted_types_check_functions = [is_pillow_image, is_numpy_image]

def ${ViewImageService.check_obj_func}(img, restricted_types=False):
    try: 
        if restricted_types:
            if not any(f(img) for f in restricted_types_check_functions):
                return False
        img = np.asarray(img)
        is_image = (img.ndim == 2) or (img.ndim == 3 and img.shape[2] in (1, 3, 4))
        return is_image
    except TypeError:
        return False

def ${ViewImageService.info_func}(img):
    obj_type = type(img).__name__
    img = np.asarray(img)
    shape = str(img.shape)
    dtype = str(img.dtype)
    return ";".join([obj_type, shape, dtype])
'''
    , _python_view_image_mod.__dict__
    )
`;

    public constructor(
        workingDir: string,
    ) {
        super(workingDir);
    }

    public async save(userSelection: UserSelection, path?: string): Promise<string | undefined> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }
        const config = currentConfigurations();
        const configValid = await this.validateConfig(config);
        if (!configValid) {
            return;
        }

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;
        path ?? (path = this.pathForSelection(userSelection));

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

    async variableInformation(variableSelection: VariableSelection): Promise<VariableInformation | undefined> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }
        const [isAnImage, _] = await this.isAnImage(variableSelection);
        if (!isAnImage) {
            return;
        }

        const imageInfo = await this.imageInformation(variableSelection);
        if (imageInfo) {
            return { name: variableSelection.variable, more: imageInfo };
        }
        else {
            return undefined;
        }
    }

    private async imageInformation(userSelection: UserSelection): Promise<ImageInformation | undefined> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;

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
            return;
        }

        try {
            const expression = (`${ViewImageService.py_module}.image_info(${vn})`);
            const res = await this.evaluate(session, expression);
            console.log(`evaluate expression result: ${res.result}`);
            const [objTypeStr, shapeStr, dtypeStr] = res.result.replace(/\'/g, "").split(";");
            if (shapeStr) {
                return {
                    type: objTypeStr,
                    shape: shapeStr,
                    dtype: dtypeStr,
                };
            }
        } catch (error) {
            console.log("imageInformation python eval error:", error);
            return;
        }

        return;

    }

    async isAnImage(userSelection: UserSelection): Promise<[boolean, string?]> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return [false];
        }

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;

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
            return [false];
        }

        try {
            const restrictImageTypes = vscode.workspace.getConfiguration("svifpd").get<boolean>("restrictImageTypes", true) ? "True" : "False";
            const expression = (`${ViewImageService.py_module}.${ViewImageService.check_obj_func}(${vn}, restricted_types=${restrictImageTypes})`);
            const res = await this.evaluate(session, expression);
            console.log(`evaluate expression result: ${res.result}`);
            const isImage = res.result;
            if (isImage === "True") {
                return [true, ""];
            }
        } catch (error) {
            console.log(error);
            return [false];
        }

        return [false];
    }

    async validateConfig(config: ImageViewConfig): Promise<boolean> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return false;
        }

        // add testing expression for each relevant configuration
        const validationExpressions = [];

        if (config.normalizationMethod === normalizationMethods.skimage_img_as_ubyte) {
            // we need to validate skimage is available
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
            });
        }

        { // test preferredBackend
            let needToBeImported: string;
            switch (config.preferredBackend) {
                case backends.Pillow:
                    needToBeImported = "PIL";
                    break;
                case backends.imageio:
                    needToBeImported = "imageio";
                    break;
                case backends.opencv:
                    needToBeImported = "cv2";
                    break;
                case backends.skimage:
                    needToBeImported = "skimage";
                    break;
                case backends.Standalone:
                default:
                    needToBeImported = "numpy";
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
            });
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
}
