import PYPLOT_CODE from "../python/plot_pyplot.py?raw";
import PLOTLY_CODE from "../python/plot_plotly.py?raw";
import { Viewable } from "./Viewable";
import { atModule as m } from "../python-communication/BuildPythonCode";

export const PlotlyFigure: Viewable = {
    group: "plot",
    type: "plotly_figure",
    title: "Figure (plotly)",
    setupPythonCode: {
        setupCode: () => PLOTLY_CODE,
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

export const PyplotFigure: Viewable = {
    group: "plot",
    type: "pyplot_figure",
    title: "Figure (pyplot)",
    setupPythonCode: {
        setupCode: () => PYPLOT_CODE,
        testSetupCode:
            "is_pyplot_figure, pyplot_figure_info, pyplot_figure_save", // require all three functions to be defined
    },
    testTypePythonCode: {
        evalCode: (expression: string) =>
            `${m("is_pyplot_figure")}(${expression})`,
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("pyplot_figure_info")}(${expression})`,
    },
    serializeObjectPythonCode: {
        evalCode: (expression: string, savePath: string) =>
            `${m("pyplot_figure_save")}('${savePath}', ${expression})`,
    },
};

export const PyplotAxes: Viewable = {
    group: "plot",
    type: "pyplot_axes",
    title: "Axes (pyplot)",
    setupPythonCode: {
        setupCode: () => PYPLOT_CODE,
        testSetupCode: "is_pyplot_ax, pyplot_ax_info, pyplot_ax_save", // require all three functions to be defined
    },
    testTypePythonCode: {
        evalCode: (expression: string) => `${m("is_pyplot_ax")}(${expression})`,
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("pyplot_ax_info")}(${expression})`,
    },
    serializeObjectPythonCode: {
        evalCode: (expression: string, savePath: string) =>
            `${m("pyplot_ax_save")}('${savePath}', ${expression})`,
    },
};
