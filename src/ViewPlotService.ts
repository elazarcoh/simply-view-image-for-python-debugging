import * as vscode from 'vscode';
import { VariableInformation, ViewerService } from './ViewerService';
import { isVariableSelection, UserSelection, VariableSelection } from './PythonSelection';

export default class ViewPlotService extends ViewerService {

    // define all the needed stuff in python.
    // keeps it in _python_view_plot_mod variable to minimize the namespace pollution as much as possible
    static readonly py_module = '_python_view_plot_mod';
    static readonly pyplot_utils: string = `
import matplotlib.pyplot as plt
def is_pyplot_figure(obj):
    try:
        return isinstance(obj, plt.Figure)
    except:
        return False
def save_pyplot_figure(path, fig=None, dpi=150, tight=False):
    if fig is None:
        fig = plt.gcf()
    if tight:
        fig.tight_layout()
    fig.savefig(path, dpi=dpi)
plotting_types['pyplot_figure'] = ("pyplot.Figure", is_pyplot_figure, save_pyplot_figure)

def is_pyplot_ax(obj):
    try:
        return isinstance(obj, plt.Axes)
    except:
        return False
def save_pyplot_ax(path, ax, dpi=150, tight=False):
    from matplotlib.transforms import Bbox
    fig = ax.figure
    if tight:
        fig.tight_layout()
    renderer = fig.canvas.get_renderer()
    items = []
    items += ax.get_xticklabels() + ax.get_yticklabels() 
    items += [ax, ax.title]
    bbox = Bbox.union([item.get_window_extent(renderer=renderer) for item in items])
    extent = bbox.transformed(fig.dpi_scale_trans.inverted())
    fig.savefig(path, bbox_inches=extent, dpi=dpi)
plotting_types['pyplot_axis'] = ("pyplot.Axis", is_pyplot_ax, save_pyplot_ax)
`;
    static readonly define_writer_expression: string = `
try:
    ${ViewPlotService.py_module}
except NameError:
    
    from types import ModuleType
    ${ViewPlotService.py_module} = ModuleType('python_view_plot_mod', '')

    exec(
'''
plotting_types = {}
try:
    ${ViewPlotService.pyplot_utils.replace(/^/gm, "    ")}
except ImportError:
    # can't load matplotlib, but we don't care
    pass

def plot_save_util_for_object(obj):  # -> Tuple[str, function, kwargs]
    for name, (repr_name, is_func, save_func) in plotting_types.items():
        if is_func(obj):
            return name, save_func, {}
    else:
        return None
def is_a_plot(obj):  # -> Tuple[bool, str]
    for name, (repr_name, is_func, _) in plotting_types.items():
        if is_func(obj):
            return True, repr_name
    else:
        return False, ""
def save(path, obj):
    save_args = plot_save_util_for_object(obj)
    if save_args is not None:
        _, save_func, kwargs = save_args
        save_func(path, obj, **kwargs)
'''
    , ${ViewPlotService.py_module}.__dict__
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
${ViewPlotService.define_writer_expression}
${ViewPlotService.py_module}.save("${py_save_path}", ${vn})
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
        const [isAPlot, type] = await this.isAPlot(variableSelection);
        if (isAPlot) {
            return { name: variableSelection.variable, more: { type: type } };
        } else {
            return undefined;
        }
    }

    async isAPlot(userSelection: UserSelection): Promise<[boolean, string]> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return [false, ""];
        }

        const vn: string = isVariableSelection(userSelection) ? userSelection.variable : userSelection.range;

        try {
            const initExpression = (
                `
exec(\"\"\"
${ViewPlotService.define_writer_expression}
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
            const expression = (`${ViewPlotService.py_module}.is_a_plot(${vn})`);
            const res = await this.evaluate(session, expression);
            console.log(`evaluate expression result: ${res.result}`);
            const [isPlot, reprName] = res.result.replace(/\(|\)| |/g, "").split(",");
            if (isPlot === "True") {
                return [true, reprName.replace(/'/g, "")];
            }
        } catch (error) {
            console.log(error);
            return [false, ""];
        }

        return [false, ""];
    }
}
