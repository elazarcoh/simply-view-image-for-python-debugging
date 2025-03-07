import PILLOW_CODE from "../python/image_pillow.py?raw";
import NUMPY_CODE from "../python/image_numpy.py?raw";
import { Viewable } from "./Viewable";
import { Backends, getConfiguration, NormalizationMethods } from "../config";
import {
  atModule as m,
  convertBoolToPython,
} from "../python-communication/BuildPythonCode";
import { ArrayDataType } from "../common/datatype";

export type NumpyImageInfo = {
  type: string;
  shape: string;
  dtype: ArrayDataType;
};

export const NumpyImage: Viewable<NumpyImageInfo> = {
  group: "image",
  type: "numpy_image",
  title: "Image",
  setupPythonCode: {
    setupCode: () => NUMPY_CODE,
    testSetupCode: "(is_numpy_image, numpy_image_info, numpy_image_save)",
    id: "numpy_image",
  },
  testTypePythonCode: {
    evalCode: (expression: string) => {
      // prettier-ignore
      return `${m('is_numpy_image')}(${expression}, restrict_types=${convertBoolToPython(getConfiguration('restrictImageTypes') ?? false)})`;
    },
  },
  infoPythonCode: {
    evalCode: (expression: string) => `${m("numpy_image_info")}(${expression})`,
  },
  serializeObjectPythonCode: {
    evalCode: (expression: string, savePath: string) =>
      // prettier-ignore
      `${m("numpy_image_save")}('${savePath}', ${expression}, backend='${getConfiguration('preferredBackend', undefined, Backends.Standalone)}', preprocess='${(getConfiguration('normalizationMethod', undefined, NormalizationMethods.None))}')`,
  },
  suffix: ".png",
  supportsImageViewer: true,
};

export type PillowImageInfo = NumpyImageInfo;

export const PillowImage: Viewable<PillowImageInfo> = {
  group: "image",
  type: "pillow_image",
  title: "Image",
  setupPythonCode: {
    setupCode: () => PILLOW_CODE,
    testSetupCode: "(is_pillow_image, pillow_image_info, pillow_image_save)", // require all three functions to be defined
    id: "pillow_image",
  },
  testTypePythonCode: {
    evalCode: (expression: string) => `${m("is_pillow_image")}(${expression})`,
  },
  infoPythonCode: {
    evalCode: (expression: string) =>
      `${m("pillow_image_info")}(${expression})`,
  },
  serializeObjectPythonCode: {
    evalCode: (expression: string, savePath: string) =>
      `${m("pillow_image_save")}('${savePath}', ${expression})`,
  },
  suffix: ".png",
  supportsImageViewer: true,
};
