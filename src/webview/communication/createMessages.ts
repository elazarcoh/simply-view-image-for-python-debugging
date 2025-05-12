import { getConfiguration } from "../../config";
import { InfoOrError } from "../../image-watch-tree/PythonObjectsList";
import { Session } from "../../session/Session";
import { getSessionData } from "../../session/SessionData";
import { hasValue, valueOrEval } from "../../utils/Utils";
import {
  AppMode,
  ExtensionRequest,
  ExtensionResponse,
  ImageMessage,
  ImagePlaceholderMessage,
  ValueVariableKind,
} from "../webview";

function expressingWithInfoIntoImagePlaceholder(
  exp: string,
  infoOrError: InfoOrError,
  valueVariableKind: ValueVariableKind,
): ImagePlaceholderMessage | undefined {
  if (infoOrError.err) {
    return undefined;
  }
  const viewables = infoOrError.safeUnwrap()[0];
  const supported =
    viewables.filter((v) => valueOrEval(v.supportsImageViewer)).length > 0;
  if (!supported) {
    return undefined;
  }
  const info = infoOrError.safeUnwrap()[1];

  return {
    image_id: ["session", exp],
    expression: exp,
    value_variable_kind: valueVariableKind,
    is_batched: viewables[0].group === "tensor", // currently, support tensor only if it's the only option
    additional_info: info,
  };
}

function imageObjects(session: Session | null): ImagePlaceholderMessage[] {
  if (session === null) {
    return [];
  }

  const currentPythonObjectsList =
    getSessionData(session)?.currentPythonObjectsList;
  const validVariables: ImagePlaceholderMessage[] =
    currentPythonObjectsList?.variablesList
      .map(([exp, info]) =>
        expressingWithInfoIntoImagePlaceholder(exp, info, "variable"),
      )
      .filter(hasValue) ?? [];
  const validExpressions: ImagePlaceholderMessage[] =
    currentPythonObjectsList
      ?.expressionsList({ skipInvalid: true })
      ?.map(([exp, info]) =>
        expressingWithInfoIntoImagePlaceholder(exp, info, "expression"),
      )
      .filter(hasValue) ?? [];

  const objects = validVariables.concat(validExpressions);
  return objects;
}

export class WebviewRequests {
  static replaceImages(session: Session | null): ExtensionRequest & {
    type: "ReplaceData";
  } {
    const replacementImages = imageObjects(session);
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

  static showImage(image_data: ImageMessage): ExtensionRequest & {
    type: "ShowImage";
  } {
    return {
      type: "ShowImage",
      image_data,
      options: {},
    };
  }

  static setMode(mode: AppMode): ExtensionRequest & {
    type: "SetMode";
  } {
    return {
      type: "SetMode",
      mode: mode,
    };
  }
}

export class WebviewResponses {
  static imagesObjects(session: Session | null): ExtensionResponse & {
    type: "ReplaceData";
  } {
    const replacementImages = imageObjects(session);
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
