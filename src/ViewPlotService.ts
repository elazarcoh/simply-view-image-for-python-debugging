import * as vscode from 'vscode';
import { join } from 'path';
import { ImageViewConfig, backends, normalizationMethods } from './types';

export default class ViewPlotService {

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
`
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

    public async ViewPlot(document: vscode.TextDocument, range: vscode.Range): Promise<string | undefined> {
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

    private async localVariables(session: vscode.DebugSession): Promise<any[]> {
        let res = await session.customRequest('scopes', { frameId: this.frameId });
        let scopes = res.scopes;
        let local = scopes[0];

        res = await session.customRequest('variables', { variablesReference: local.variablesReference });
        let variables: any[] = res.variables;

        return variables;
    }

    async isAPlot(document: vscode.TextDocument, range: vscode.Range): Promise<[boolean, string]> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return [false, ""];
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
            return [false, ""];
        }

        // test if evaluated to numpy array legal image

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
            const [isPlot, reprName] = res.result.replaceAll("(", "").replaceAll(")", "").replaceAll(" ", "").split(",")
            if (isPlot === "True") {
                return [true, reprName.replaceAll("'", "")];
            }
        } catch (error) {
            console.log(error);
            return [false, ""];
        }

        return [false, ""];
    }

    private evaluate(session: vscode.DebugSession, expression: string) {
        return session.customRequest("evaluate", { expression: expression, frameId: this.frameId, context: 'hover' });
    }
}
