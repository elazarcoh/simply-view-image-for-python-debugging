import { getConfiguration } from "../../config";
import { activeDebugSessionData } from "../../debugger-utils/DebugSessionsHolder";
import { InfoOrError } from "../../image-watch-tree/PythonObjectsList";
import { hasValue } from "../../utils/Utils";
import {
    ExtensionRequest,
    ExtensionResponse,
    ImageMessage,
    ImageObjects,
    ValueVariableKind,
} from "../webview";

function expressingWithInfoIntoImageInfo(
    exp: string,
    infoOrError: InfoOrError,
    valueVariableKind: ValueVariableKind
): ImageMessage | undefined {
    if (infoOrError.err) {
        return undefined;
    }
    const viewables = infoOrError.safeUnwrap()[0];
    const supported = viewables.filter((v) => v.supportsImageViewer).length > 0;
    if (!supported) {
        return undefined;
    }
    const info = infoOrError.safeUnwrap()[1];

    return {
        image_id: exp,
        expression: exp,
        value_variable_kind: valueVariableKind,
        width: 0,
        height: 0,
        channels: 1,
        datatype: "float32",
        additional_info: info,
        max: null,
        min: null,
        bytes: null,
        data_ordering: "hwc",
    };
}

function imageObjects(): ImageObjects {
    const currentPythonObjectsList =
        activeDebugSessionData()?.currentPythonObjectsList;
    const validVariables: ImageMessage[] =
        currentPythonObjectsList?.variablesList
            .map(([exp, info]) =>
                expressingWithInfoIntoImageInfo(exp, info, "variable")
            )
            .filter(hasValue) ?? [];
    const validExpressions: ImageMessage[] =
        currentPythonObjectsList
            ?.expressionsList({ skipInvalid: true })
            ?.map(([exp, info]) =>
                expressingWithInfoIntoImageInfo(exp, info, "expression")
            )
            .filter(hasValue) ?? [];

    const objects = validVariables.concat(validExpressions);
    return objects;
}

export class WebviewRequests {
    static replaceData(): ExtensionRequest & {
        type: "ReplaceData";
    } {
        const replacementImages = imageObjects();
        return {
            type: "ReplaceData",
            replacement_images: replacementImages,
        };
    }

    static configuration(): ExtensionRequest & {
        type: "Configuration";
    } {
        return {
            type: "Configuration",
            invert_scroll_direction:
                getConfiguration("viewerUi.invertMouseWheelZoom") ?? null,
        };
    }
}

export class WebviewResponses {
    static showImage(image_data: ImageMessage): ExtensionRequest & {
        type: "ShowImage";
    } {
        return {
            type: "ShowImage",
            image_data,
            options: {},
        };
    }

    static imagesObjects(): ExtensionResponse & {
        type: "ReplaceData";
    } {
        const replacementImages = imageObjects();
        return {
            type: "ReplaceData",
            replacement_images: replacementImages,
        };
    }

    static imageData(imageData: ImageMessage): ExtensionResponse & {
        type: "ImageData";
    } {
        return {
            type: "ImageData",
            ...imageData,
        };
    }
}
