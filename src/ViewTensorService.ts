import * as vscode from 'vscode';
import { VariableInformation, ViewerService } from './ViewerService';
import { isVariableSelection, UserSelection, VariableSelection } from './PythonSelection';

type TensorInformation = {
    shape: string,
    dtype: string,
};

export default class ViewTensorService extends ViewerService {

    // define all the needed stuff in python.
    // keeps it in _python_view_tensor_mod variable to minimize the namespace pollution as much as possible
    static readonly py_module = '_python_view_torch_mod';
    static readonly tensor_types = 'tensor_types';
    static readonly save_func = 'save';
    static readonly check_obj_func = 'is_a';
    static readonly info_func = 'tensor_info';

    static readonly torch_utils: string = `
import torchvision, torch
def is_torch_tensor(obj):
    try:
        is_valid = isinstance(obj, torch.Tensor)
        is_valid &= len(obj.shape) in (3, 4)
        if len(obj) == 3:
            is_valid &= obj.shape[0] in (1, 3)
        elif len(obj) == 4:
            is_valid &= obj.shape[1] in (1, 3)
        return is_valid
    except:
        return False
def save_torch_tensor(path, tensor, normalize=True, pad=10):
    pad_value = 255
    torchvision.utils.save_image(tensor, path, normalize=normalize,  pad_value=pad_value, padding=pad)
${ViewTensorService.tensor_types}['torch_tensor'] = ("torch.Tensor", is_torch_tensor, save_torch_tensor)
`;
    static readonly define_writer_expression: string = `
try:
    ${ViewTensorService.py_module}
except NameError:
    
    from types import ModuleType
    ${ViewTensorService.py_module} = ModuleType('python_view_tensor_mod', '')

    exec(
'''
${ViewTensorService.tensor_types} = {}
try:
    ${ViewTensorService.torch_utils.replace(/^/gm, "    ")}
except ImportError:
    # can't load torch, but we don't care
    pass

def tensor_save_util_for_object(obj):  # -> Tuple[str, function, kwargs]
    for name, (repr_name, is_func, save_func) in ${ViewTensorService.tensor_types}.items():
        if is_func(obj):
            return name, save_func, {}
    else:
        return None
def ${ViewTensorService.check_obj_func}(obj):  # -> Tuple[bool, str]
    for name, (repr_name, is_func, _) in ${ViewTensorService.tensor_types}.items():
        if is_func(obj):
            return True, repr_name
    else:
        return False, ""
def ${ViewTensorService.save_func}(path, obj):
    save_args = tensor_save_util_for_object(obj)
    if save_args is not None:
        _, save_func, kwargs = save_args
        save_func(path, obj, **kwargs)
def ${ViewTensorService.info_func}(tensor):
    shape = str(tuple(tensor.shape))
    dtype = str(tensor.dtype)
    return ";".join([shape, dtype])
'''
    , ${ViewTensorService.py_module}.__dict__
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

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;
        path ?? (path = this.pathForSelection(userSelection));

        const py_save_path = path.replace(/\\/g, '/');

        const expression = (
            `
exec(\"\"\"
${ViewTensorService.define_writer_expression}
${ViewTensorService.py_module}.${ViewTensorService.save_func}("${py_save_path}", ${vn})
\"\"\"
)
`
        );

        try {
            const res = await this.evaluate(session, expression);
            console.log(`result: ${res.result}`);
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
        const [isATensor, _] = await this.isATensor(variableSelection);
        if (!isATensor) {
            return;
        }

        const tensorInfo = await this.tensorInformation(variableSelection);
        if (tensorInfo) {
            return { name: variableSelection.variable, more: tensorInfo };
        }
        else {
            return undefined;
        }
    }

    private async tensorInformation(userSelection: UserSelection): Promise<TensorInformation | undefined> {
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
${ViewTensorService.define_writer_expression}
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
            const expression = (`${ViewTensorService.py_module}.${ViewTensorService.info_func}(${vn})`);
            const res = await this.evaluate(session, expression);
            console.log(`evaluate expression result: ${res.result}`);
            const [shapeStr, dtypeStr] = res.result.replace(/'/g, "").split(";");
            if (shapeStr) {
                return {
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

    async isATensor(userSelection: UserSelection): Promise<[boolean, string]> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return [false, ""];
        }

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;

        try {
            const initExpression = (
                `
exec(\"\"\"
${ViewTensorService.define_writer_expression}
\"\"\"
)
`
            );
            const res = await this.evaluate(session, initExpression);
            console.log(`evaluate initExpression result: ${res.result}`);
        } catch (error) {
            console.log(error);
            return [false, ""];
        }

        try {
            const expression = (`${ViewTensorService.py_module}.${ViewTensorService.check_obj_func}(${vn})`);
            const res = await this.evaluate(session, expression);
            console.log(`evaluate expression result: ${res.result}`);
            const [isTensor, reprName] = res.result.replace(/\(|\)| |/g, "").split(",");
            if (isTensor === "True") {
                return [true, reprName.replace(/'/g, "")];
            }
        } catch (error) {
            console.log(error);
            return [false, ""];
        }

        return [false, ""];
    }
}
