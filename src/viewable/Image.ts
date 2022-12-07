import PILLOW_CODE from "../python/image_pillow.py?raw";
import NUMPY_CODE from "../python/image_numpy.py?raw";
import { Viewable } from "./Viewable";
import { getConfiguration } from "../config";
import {
    atModule as m,
    convertBoolToPython,
} from "../python-communication/PythonCodeUtils";

export const NumpyImage: Viewable = {
    group: "image",
    type: "numpy_image",
    setupPythonCode: {
        setupCode: NUMPY_CODE,
        testSetupCode: "(is_numpy_image, numpy_image_info, numpy_image_save)", // require all three functions to be defined
    },
    testTypePythonCode: {
        evalCode: (expression: string) => {
            // prettier-ignore
            return `${m('is_numpy_image')}(${expression}, restrict_types=${convertBoolToPython(getConfiguration('restrictImageTypes') ?? false)})`
        },
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("numpy_image_info")}(${expression})`,
    },
};

export const PillowImage: Viewable = {
    group: "image",
    type: "pillow_image",
    setupPythonCode: {
        setupCode: PILLOW_CODE,
        testSetupCode:
            "(is_pillow_image, pillow_image_info, pillow_image_save)", // require all three functions to be defined
    },
    testTypePythonCode: {
        evalCode: (expression: string) =>
            `${m("is_pillow_image")}(${expression})`,
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("pillow_image_info")}(${expression})`,
    },
};
