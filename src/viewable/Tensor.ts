import NUMPY_TENSOR_CODE from "../python/numpy_tensor.py?raw";
import TORCH_TENSOR_CODE from "../python/torch_tensor.py?raw";
import { Viewable } from "./Viewable";
import { atModule as m } from "../python-communication/BuildPythonCode";
import { ArrayDataType } from "../common/datatype";

export type NumpyTensorInfo = {
    type: string;
    shape: string;
    dtype: ArrayDataType;
};

export const NumpyTensor: Viewable<NumpyTensorInfo> = {
    group: "tensor",
    type: "numpy_tensor",
    title: "Tensor (numpy)",
    setupPythonCode: {
        setupCode: () => NUMPY_TENSOR_CODE,
        testSetupCode: "is_numpy_tensor, numpy_tensor_info, numpy_tensor_save", // require all three functions to be defined
        id: "numpy_tensor",
    },
    testTypePythonCode: {
        evalCode: (expression: string) =>
            `${m("is_numpy_tensor")}(${expression})`,
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("numpy_tensor_info")}(${expression})`,
    },
    serializeObjectPythonCode: {
        evalCode: (expression: string, savePath: string) =>
            `${m("numpy_tensor_save")}('${savePath}', ${expression})`,
    },
    suffix: ".png",
    supportsImageViewer: false,
};

export type TorchTensorInfo = NumpyTensorInfo;

export const TorchTensor: Viewable<TorchTensorInfo> = {
    group: "tensor",
    type: "torch_tensor",
    title: "Tensor (torch)",
    setupPythonCode: {
        setupCode: () => TORCH_TENSOR_CODE,
        testSetupCode: "is_torch_tensor, torch_tensor_info, torch_tensor_save", // require all three functions to be defined
        id: "torch_tensor",
    },
    testTypePythonCode: {
        evalCode: (expression: string) =>
            `${m("is_torch_tensor")}(${expression})`,
    },
    infoPythonCode: {
        evalCode: (expression: string) =>
            `${m("torch_tensor_info")}(${expression})`,
    },
    serializeObjectPythonCode: {
        evalCode: (expression: string, savePath: string) =>
            `${m("torch_tensor_save")}('${savePath}', ${expression})`,
    },
    suffix: ".png",
    supportsImageViewer: false,
};
