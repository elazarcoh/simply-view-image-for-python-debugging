import * as vscode from "vscode";
import { EXTENSION_CUSTOM_EDITOR_ID } from "./globals";
import { WebviewCommunication } from "./webview/communication/WebviewClient";
import { ImageViewPanel } from "./webview/panels/ImageViewPanel";
import { disposeAll } from "./utils/VSCodeUtils";
import { SingleImageModeWebviewMessageHandler } from "./webview/communication/SingleImageModeWebviewMessageHandler";
import * as ExifReader from "exifreader";
import { Jimp } from "jimp";
import { ImageMessage } from "./webview/webview";

const PNG_COLOR_TYPE: Record<number, { channels: 1 | 2 | 3 | 4 }> = {
  0: { channels: 1 },
  2: { channels: 3 },
  3: { channels: 1 },
  4: { channels: 2 },
  6: { channels: 4 },
};

function getByFileType(tags: ExifReader.Tags): {
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
} {
  const fileType = tags.FileType?.value;
  if (fileType.toUpperCase() === "PNG") {
    const width = tags["Image Width"]?.value;
    const height = tags["Image Height"]?.value;
    const colorType = tags["Color Type"]?.value as
      | keyof typeof PNG_COLOR_TYPE
      | undefined;
    const channels =
      colorType !== undefined ? PNG_COLOR_TYPE[colorType].channels : undefined;

    if (width === undefined || height === undefined || channels === undefined) {
      throw new Error("Missing image dimensions or channels");
    }

    return { width, height, channels };
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

function prepareBuffer(
  inputBuffer: Buffer,
  numInputChannels: 3 | 4,
  outputLength: number,
  numChannels: number,
): ArrayBuffer {
  // copy buffer with skips, depending on the number of channels:
  // For 4-channel images:
  //   4 channels: simply copy the buffer
  //   3 channels: skip the alpha channel
  //   2 channels: copy the first and fourth channel
  //   1 channel: copy the first channel
  // For 3-channel images:
  //   4 channels: copy the first three channels
  //   3 channels: simply copy the buffer
  //   2 channels: copy the first and third channel
  //   1 channel: copy the first channel
  const arrayBuffer = new ArrayBuffer(outputLength);
  const arrayData = new Uint8Array(arrayBuffer);

  const ic = numInputChannels;
  if (numChannels === ic) {
    arrayData.set(inputBuffer);
  } else if (
    (numChannels === 3 && ic === 4) ||
    (numChannels === 4 && ic === 3)
  ) {
    // This works for both 3 and 4 channel images
    const fillAlpha = ic === 3 && numChannels === 4;
    for (let i = 0; i < inputBuffer.length; i += ic) {
      const base = (i / ic) * numChannels;
      arrayData[base] = inputBuffer[i];
      arrayData[base + 1] = inputBuffer[i + 1];
      arrayData[base + 2] = inputBuffer[i + 2];
      if (fillAlpha) {
        arrayData[base + 3] = 255;
      }
    }
  } else if (numChannels === 2) {
    for (let i = 0; i < inputBuffer.length; i += ic) {
      const base = (i / ic) * numChannels;
      arrayData[base] = inputBuffer[i];
      arrayData[base + 1] = inputBuffer[i + 1];
    }
  } else if (numChannels === 1) {
    for (let i = 0; i < inputBuffer.length; i += ic) {
      arrayData[i / ic] = inputBuffer[i];
    }
  } else {
    throw new Error(`Unsupported number of channels: ${numChannels}`);
  }

  return arrayBuffer;
}
async function createMessage(uri: vscode.Uri): Promise<ImageMessage> {
  const tags = await ExifReader.load(uri.fsPath);
  const image = await Jimp.read(uri.fsPath);

  const { width, height, channels } = getByFileType(tags);

  const outputLength = width * height * channels;
  const inputChannels = image.bitmap.data.length / (width * height);
  if (inputChannels !== 3 && inputChannels !== 4) {
    throw new Error("Unsupported number of input channels");
  }
  const arrayBuffer = prepareBuffer(
    image.bitmap.data,
    inputChannels as 3 | 4,
    outputLength,
    channels,
  );

  const imageMessage: ImageMessage = {
    image_id: uri.toString(),
    value_variable_kind: "variable",
    expression: "image",
    width: width,
    height: height,
    channels: channels as 1 | 2 | 3 | 4,
    datatype: "uint8",
    is_batched: false,
    batch_size: null,
    batch_items_range: null,
    additional_info: {},
    min: null,
    max: null,
    data_ordering: "hwc",
    bytes: arrayBuffer,
  };
  return imageMessage;
}

export class ImagePreviewCustomEditor
  implements vscode.CustomReadonlyEditorProvider, vscode.Disposable
{
  public static readonly viewType = EXTENSION_CUSTOM_EDITOR_ID;

  private _webviewMessageHandler?: SingleImageModeWebviewMessageHandler;

  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async openCustomDocument(uri: vscode.Uri) {
    return { uri, dispose: () => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel,
  ): Promise<void> {
    console.log("resolveCustomEditor", document.uri.toString());

    try {
      const imageMessage = await createMessage(document.uri);

      const webviewCommunication = new WebviewCommunication(
        webviewEditor.webview,
      );
      this._webviewMessageHandler = new SingleImageModeWebviewMessageHandler(
        webviewCommunication,
      );

      ImageViewPanel.render(this.context, webviewEditor);
      webviewCommunication.waitForReady().then(() => {
        console.log("isReady", webviewCommunication.isReady);
        webviewCommunication.sendRequest({
          type: "ShowImage",
          image_data: imageMessage,
          options: {},
        });
      });
    } catch (error) {
      console.error(error);
    }
  }

  dispose() {
    disposeAll(this._disposables);
  }
}
