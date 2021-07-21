import * as vscode from 'vscode';
import { join } from 'path';
import { ViewerService } from './ViewerService';
import { isVariableSelection } from './PythonSelection';

export default class ViewTensorService extends ViewerService {

    // define all the needed stuff in python.
    // keeps it in _python_view_tensor_mod variable to minimize the namespace pollution as much as possible
    static readonly py_module = '_python_view_torch_mod';
    static readonly tensor_types = 'tensor_types';
    static readonly save_func = 'save';
    static readonly check_obj_func = 'is_a';

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
`
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
'''
    , ${ViewTensorService.py_module}.__dict__
    )
`;

    public constructor(
        workingDir: string,
    ) {
        super(workingDir);
    }

    public async ViewTensor(document: vscode.TextDocument, range: vscode.Range): Promise<string | undefined> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }
        const userSelection = await this.variableNameOrExpression(session, document, range);
        if (userSelection === undefined) {
            return;
        }

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;
        const path = this.pathForSelection(userSelection);

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
            console.log(`evaluate ${expression} result: ${res.result}`);
        } catch (error) {
            console.log(error);
            vscode.window.showErrorMessage(`could not show image for "${vn}". please check log.`);
            return;
        }

        return path;
    }

    async isATensor(document: vscode.TextDocument, range: vscode.Range): Promise<[boolean, string]> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return [false, ""];
        }
        const userSelection = await this.variableNameOrExpression(session, document, range);
        if (userSelection === undefined) {
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
            const [isTensor, reprName] = res.result.replaceAll("(", "").replaceAll(")", "").replaceAll(" ", "").split(",")
            if (isTensor === "True") {
                return [true, reprName.replaceAll("'", "")];
            }
        } catch (error) {
            console.log(error);
            return [false, ""];
        }

        return [false, ""];
    }
}
