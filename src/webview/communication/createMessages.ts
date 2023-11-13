import { activeDebugSessionData } from "../../debugger-utils/DebugSessionsHolder";
import { InfoOrError } from "../../image-watch-tree/PythonObjectsList";
import { hasValue } from "../../utils/Utils";
import {
    ExtensionRequest,
    ExtensionResponse,
    ImageData,
    ImageInfo,
    ImageObjects,
    ValueVariableKind,
} from "../webview";

function expressingWithInfoIntoImageInfo(
    exp: string,
    infoOrError: InfoOrError,
    valueVariableKind: ValueVariableKind
): ImageInfo | undefined {
    if (infoOrError.isError) {
        return undefined;
    }
    const info = infoOrError.result[1];

    return {
        image_id: exp,
        expression: exp,
        value_variable_kind: valueVariableKind,
        // TODO: Implement this
        width: 100,
        height: 100,
        channels: 1,
        datatype: "float32",
        additional_info: info,
    };
}

function imageObjects(): ImageObjects {
    const validVariables: ImageInfo[] =
        activeDebugSessionData()
            ?.currentPythonObjectsList?.variablesList.map(([exp, info]) =>
                expressingWithInfoIntoImageInfo(exp, info, "variable")
            )
            .filter(hasValue) ?? [];
    const validExpressions: ImageInfo[] = []; // TODO: Implement this
    const objects = validVariables.concat(validExpressions);
    return {
        objects,
    };
}

export class WebviewRequests {
    static replaceData(): ExtensionRequest & {
        type: "ReplaceData";
    } {
        const replacementImages = imageObjects();
        return {
            type: "ReplaceData",
            replacement_data: {},
            replacement_images: replacementImages,
        };
    }
}

export class WebviewResponses {
    static showImage(image_data: ImageData): ExtensionRequest & {
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
            replacement_data: {},
            replacement_images: replacementImages,
        };
    }

    static imageData(imageData: ImageData): ExtensionResponse & {
        type: "ImageData";
    } {
        return {
            type: "ImageData",
            ...imageData,
        };
    }
}
