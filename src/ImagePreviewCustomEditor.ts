import type { Buffer } from 'node:buffer';
import type { ImageMessage } from './webview/webview';
import * as ExifReader from 'exifreader';
import { Jimp, JimpMime } from 'jimp';
import * as vscode from 'vscode';
import { EXTENSION_CUSTOM_EDITOR_ID } from './globals';
import { Ok } from './utils/Result';
import { disposeAll } from './utils/VSCodeUtils';
import { SingleImageModeWebviewMessageHandler } from './webview/communication/SingleImageModeWebviewMessageHandler';
import { WebviewCommunication } from './webview/communication/WebviewClient';
import { ImageViewPanel } from './webview/panels/ImageViewPanel';

type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;

const PNG_COLOR_TYPE: Record<number, { channels: 1 | 2 | 3 | 4 }> = {
  0: { channels: 1 },
  2: { channels: 3 },
  3: { channels: 1 },
  4: { channels: 2 },
  6: { channels: 4 },
};

async function getByFileType(
  image: JimpImage,
  uri: vscode.Uri,
): Promise<{ width: number; height: number; channels: 1 | 2 | 3 | 4 }> {
  if (image.mime === JimpMime.png) {
    const tags = await ExifReader.load(uri.fsPath);
    const width = tags['Image Width']?.value;
    const height = tags['Image Height']?.value;
    const colorType = tags['Color Type']?.value as
      | keyof typeof PNG_COLOR_TYPE
      | undefined;
    const channels
      = colorType !== undefined ? PNG_COLOR_TYPE[colorType].channels : undefined;

    if (width === undefined || height === undefined || channels === undefined) {
      throw new Error('Missing image dimensions or channels');
    }

    return { width, height, channels };
  }
  else if (image.mime === JimpMime.bmp) {
    let channels: 1 | 2 | 3 | 4;
    const bp = image.bitmap;
    if ('bitPP' in bp === false) {
      throw new Error('Unsupported BMP image. Missing bitPP property');
    }
    const bitsPerPixel = bp.bitPP;
    switch (bitsPerPixel) {
      case 1: {
        channels = 1;
        break;
      }
      case 8: {
        channels = 1;
        break;
      }
      case 16: {
        channels = 4;
        throw new Error('16-bit BMP images are not supported yet');
      }
      case 24: {
        channels = 3;
        break;
      }
      case 32: {
        channels = 4;
        break;
      }
      default: {
        throw new Error(`Unsupported bits per pixel: ${bitsPerPixel}`);
      }
    }

    return {
      width: image.bitmap.width,
      height: image.bitmap.height,
      channels,
    };
  }
  else if (image.mime === JimpMime.tiff) {
    const tags = await ExifReader.load(uri.fsPath);
    const width = tags.ImageWidth?.value;
    const height = tags.ImageLength?.value;
    const samplesPerPixel = tags.SamplesPerPixel?.value;

    return {
      width: width as number,
      height: height as number,
      channels: samplesPerPixel as 1 | 2 | 3 | 4,
    };
  }
  else if (image.mime === JimpMime.jpeg) {
    const tags = await ExifReader.load(uri.fsPath);
    const width = tags['Image Width']?.value;
    const height = tags['Image Height']?.value;
    const colorComponents = tags['Color Components']?.value;
    if (typeof colorComponents !== 'number') {
      throw new TypeError('Missing color components');
    }
    if ([1, 3, 4].includes(colorComponents) === false) {
      throw new Error(
        `Unsupported number of color components: ${colorComponents}`,
      );
    }

    return {
      width: width as number,
      height: height as number,
      channels: colorComponents as 1 | 2 | 3 | 4,
    };
  }
  else {
    throw new Error(`Unsupported file type: ${image.mime}`);
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
  }
  else if (
    (numChannels === 3 && ic === 4)
    || (numChannels === 4 && ic === 3)
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
  }
  else if (numChannels === 2) {
    for (let i = 0; i < inputBuffer.length; i += ic) {
      const base = (i / ic) * numChannels;
      arrayData[base] = inputBuffer[i];
      arrayData[base + 1] = inputBuffer[i + 1];
    }
  }
  else if (numChannels === 1) {
    for (let i = 0; i < inputBuffer.length; i += ic) {
      arrayData[i / ic] = inputBuffer[i];
    }
  }
  else {
    throw new Error(`Unsupported number of channels: ${numChannels}`);
  }

  return arrayBuffer;
}
async function createMessage(uri: vscode.Uri): Promise<ImageMessage> {
  const image = await Jimp.read(uri.fsPath);

  const { width, height, channels } = await getByFileType(image, uri);

  const outputLength = width * height * channels;
  const inputChannels = image.bitmap.data.length / (width * height);
  if (inputChannels !== 3 && inputChannels !== 4) {
    throw new Error('Unsupported number of input channels');
  }
  const arrayBuffer = prepareBuffer(
    image.bitmap.data,
    inputChannels as 3 | 4,
    outputLength,
    channels,
  );

  const imageMessage: ImageMessage = {
    image_id: ['customEditorSession', uri.toString()],
    value_variable_kind: 'variable',
    expression: 'image',
    width,
    height,
    channels: channels as 1 | 2 | 3 | 4,
    datatype: 'uint8',
    is_batched: false,
    batch_size: null,
    batch_items_range: null,
    additional_info: {},
    min: null,
    max: null,
    data_ordering: 'hwc',
    bytes: arrayBuffer,
  };
  return imageMessage;
}

export class ImagePreviewCustomEditor
implements vscode.CustomReadonlyEditorProvider, vscode.Disposable {
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
    try {
      const imageMessage = await createMessage(document.uri);

      const webviewCommunication = new WebviewCommunication(
        webviewEditor.webview,
      );
      this._webviewMessageHandler = new SingleImageModeWebviewMessageHandler(
        webviewCommunication,
        () => Promise.resolve(Ok(imageMessage)),
      );

      ImageViewPanel.render(this.context, webviewEditor);
      webviewCommunication.waitForReady().then(() => {
        webviewCommunication.sendRequest({
          type: 'ShowImage',
          image_data: imageMessage,
          options: {},
        });
      });
    }
    catch (error) {
      console.error(error);
    }
  }

  dispose() {
    disposeAll(this._disposables);
  }
}

export async function openFileImage() {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (activeTab === undefined) {
    return;
  }
  const input = activeTab.input;
  if (typeof input === 'object' && input !== null && 'uri' in input) {
    const { uri } = input;
    await vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      ImagePreviewCustomEditor.viewType,
    );
  }
  else {
    vscode.window.showErrorMessage('Failed to open the file');
  }
}
