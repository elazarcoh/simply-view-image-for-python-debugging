import PYPLOT_CODE from "../python/plot_pyplot.py?raw";
import PLOTLY_CODE from "../python/plot_plotly.py?raw";
import { Viewable } from "./Viewable";
import {
    atModule as m,
    convertBoolToPython,
} from "../python-communication/PythonCodeUtils";

export const MatplotlibFigure: Viewable = {
    group: "plot",
    type: "matplotlib_figure",
    title: "Figure (pyplot)",
    setupPythonCode: {
        setupCode: PYPLOT_CODE,
        testSetupCode:
            "is_plotly_figure, plotly_figure_info, plotly_figure_save", // require all three functions to be defined
    },
    testTypePythonCode: {
        evalCode: (expression: string) =>
            `${m("is_plotly_figure")}(${expression})`,
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("plotly_figure_info")}(${expression})`,
    },
    serializeObjectPythonCode: {
        evalCode: (expression: string, savePath: string) =>
            `${m("plotly_figure_save")}('${savePath}', ${expression})`,
    },
};
