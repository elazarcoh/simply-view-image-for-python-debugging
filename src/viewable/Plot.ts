import type { Viewable } from './Viewable';
import { getConfiguration } from '../config';
import {
  convertBoolToPython,
  atModule as m,
} from '../python-communication/BuildPythonCode';
import PLOTLY_CODE from '../python/plot_plotly.py?raw';
import PYPLOT_CODE from '../python/plot_pyplot.py?raw';

export const PlotlyFigure: Viewable<{ type: string }> = {
  group: 'plot',
  type: 'plotly_figure',
  title: 'Figure (plotly)',
  setupPythonCode: {
    setupCode: () => PLOTLY_CODE,
    testSetupCode: 'is_plotly_figure, plotly_figure_info, plotly_figure_save',
    id: 'plotly_figure',
  },
  testTypePythonCode: {
    evalCode: (expression: string) => `${m('is_plotly_figure')}(${expression})`,
  },
  infoPythonCode: {
    evalCode: (expression: string) =>
      `${m('plotly_figure_info')}(${expression})`,
  },
  serializeObjectPythonCode: {
    evalCode: (expression: string, savePath: string) =>
      `${m('plotly_figure_save')}('${savePath}', ${expression})`,
  },
  suffix: '.png',
  supportsImageViewer: false,
};

export const PyplotFigure: Viewable<{ type: string }> = {
  group: 'plot',
  type: 'pyplot_figure',
  title: 'Figure (pyplot)',
  setupPythonCode: {
    setupCode: () => {
      return (
        `${PYPLOT_CODE
        // prettier-ignore
        }\nset_matplotlib_agg(${convertBoolToPython(getConfiguration('matplotlibUseAgg') ?? false)})`
      );
    },
    testSetupCode: 'is_pyplot_figure, pyplot_figure_info, pyplot_figure_save', // require all three functions to be defined
    id: 'pyplot_figure',
  },
  testTypePythonCode: {
    evalCode: (expression: string) => `${m('is_pyplot_figure')}(${expression})`,
  },
  infoPythonCode: {
    evalCode: (expression: string) =>
      `${m('pyplot_figure_info')}(${expression})`,
  },
  serializeObjectPythonCode: {
    evalCode: (expression: string, savePath: string) =>
      `${m('pyplot_figure_save')}('${savePath}', ${expression})`,
  },
  suffix: '.png',
  supportsImageViewer: false,
};

export const PyplotAxes: Viewable<{ type: string }> = {
  group: 'plot',
  type: 'pyplot_axes',
  title: 'Axes (pyplot)',
  setupPythonCode: {
    setupCode: () => {
      return (
        `${PYPLOT_CODE
        // prettier-ignore
        }\nset_matplotlib_agg(${convertBoolToPython(getConfiguration('matplotlibUseAgg') ?? false)})`
      );
    },
    testSetupCode: 'is_pyplot_ax, pyplot_ax_info, pyplot_ax_save', // require all three functions to be defined
    id: 'pyplot_axes',
  },
  testTypePythonCode: {
    evalCode: (expression: string) => `${m('is_pyplot_ax')}(${expression})`,
  },
  infoPythonCode: {
    evalCode: (expression: string) => `${m('pyplot_ax_info')}(${expression})`,
  },
  serializeObjectPythonCode: {
    evalCode: (expression: string, savePath: string) =>
      `${m('pyplot_ax_save')}('${savePath}', ${expression})`,
  },
  suffix: '.png',
  supportsImageViewer: false,
};
