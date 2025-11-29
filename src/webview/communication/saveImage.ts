import type { ImageMessage } from '../webview';
import { Buffer } from 'node:buffer';
import { Jimp } from 'jimp';

/**
 * Converts image data from CHW (Channel, Height, Width) to HWC (Height, Width, Channel) format.
 */
function chwToHwc(
  data: Uint8Array,
  height: number,
  width: number,
  channels: number,
  bytesPerElement: number,
): Uint8Array {
  const result = new Uint8Array(data.length);
  const pixelCount = height * width;

  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      for (let c = 0; c < channels; c++) {
        const srcIdx = (c * pixelCount + h * width + w) * bytesPerElement;
        const dstIdx = ((h * width + w) * channels + c) * bytesPerElement;
        for (let b = 0; b < bytesPerElement; b++) {
          result[dstIdx + b] = data[srcIdx + b];
        }
      }
    }
  }

  return result;
}

/**
 * Gets the byte size for a given datatype.
 */
function getDatatypeBytes(datatype: ImageMessage['datatype']): number {
  switch (datatype) {
    case 'uint8':
    case 'int8':
    case 'bool':
      return 1;
    case 'uint16':
    case 'int16':
      return 2;
    case 'uint32':
    case 'int32':
    case 'float32':
      return 4;
    default:
      return 1;
  }
}

/**
 * Normalizes image data to uint8 [0, 255] range for saving as PNG.
 */
function normalizeToUint8(
  data: Uint8Array,
  datatype: ImageMessage['datatype'],
  min: number[] | null,
  max: number[] | null,
  channels: number,
): Uint8Array {
  const bytesPerElement = getDatatypeBytes(datatype);
  const pixelCount = data.length / (bytesPerElement * channels);
  const result = new Uint8Array(pixelCount * channels);

  // Create a typed array view based on the datatype
  let typedData: ArrayLike<number>;
  switch (datatype) {
    case 'uint8':
    case 'bool':
      typedData = data;
      break;
    case 'int8':
      // Int8Array has 1 byte per element, same as Uint8Array
      typedData = new Int8Array(data.buffer, data.byteOffset, data.length);
      break;
    case 'uint16':
      typedData = new Uint16Array(
        data.buffer,
        data.byteOffset,
        data.length / 2,
      );
      break;
    case 'int16':
      typedData = new Int16Array(
        data.buffer,
        data.byteOffset,
        data.length / 2,
      );
      break;
    case 'uint32':
      typedData = new Uint32Array(
        data.buffer,
        data.byteOffset,
        data.length / 4,
      );
      break;
    case 'int32':
      typedData = new Int32Array(
        data.buffer,
        data.byteOffset,
        data.length / 4,
      );
      break;
    case 'float32':
      typedData = new Float32Array(
        data.buffer,
        data.byteOffset,
        data.length / 4,
      );
      break;
    default:
      typedData = data;
  }

  // If data is already uint8 and no custom min/max is specified, use directly
  // This preserves the original pixel values without normalization
  if (datatype === 'uint8' && min === null && max === null) {
    result.set(data);
    return result;
  }

  // Compute min/max for normalization if not provided
  const computedMin: number[] = [];
  const computedMax: number[] = [];

  for (let c = 0; c < channels; c++) {
    if (min !== null && min[c] !== undefined) {
      computedMin[c] = min[c];
    }
    else {
      let channelMin = Number.POSITIVE_INFINITY;
      for (let i = c; i < typedData.length; i += channels) {
        if (typedData[i] < channelMin) {
          channelMin = typedData[i];
        }
      }
      computedMin[c] = channelMin;
    }

    if (max !== null && max[c] !== undefined) {
      computedMax[c] = max[c];
    }
    else {
      let channelMax = Number.NEGATIVE_INFINITY;
      for (let i = c; i < typedData.length; i += channels) {
        if (typedData[i] > channelMax) {
          channelMax = typedData[i];
        }
      }
      computedMax[c] = channelMax;
    }
  }

  // Normalize to [0, 255]
  for (let i = 0; i < typedData.length; i++) {
    const c = i % channels;
    const range = computedMax[c] - computedMin[c];
    if (range === 0) {
      result[i] = 0;
    }
    else {
      const normalized = (typedData[i] - computedMin[c]) / range;
      result[i] = Math.round(Math.max(0, Math.min(255, normalized * 255)));
    }
  }

  return result;
}

/**
 * Saves an ImageMessage to a PNG file.
 */
export async function saveImageToFile(
  imageMessage: ImageMessage,
  filePath: string,
): Promise<void> {
  const { width, height, channels, datatype, data_ordering, bytes, min, max }
    = imageMessage;

  if (bytes === null) {
    throw new Error('Image has no data');
  }

  let data = new Uint8Array(bytes);
  const bytesPerElement = getDatatypeBytes(datatype);

  // Convert CHW to HWC if necessary
  if (data_ordering === 'chw') {
    data = chwToHwc(data, height, width, channels, bytesPerElement);
  }

  // Normalize to uint8
  const normalizedData = normalizeToUint8(data, datatype, min, max, channels);

  // Prepare RGBA data for Jimp (Jimp always uses RGBA format)
  const rgbaData = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * channels;
    const dstIdx = i * 4;

    switch (channels) {
      case 1:
        // Grayscale: duplicate to RGB, set alpha to 255
        rgbaData[dstIdx] = normalizedData[srcIdx];
        rgbaData[dstIdx + 1] = normalizedData[srcIdx];
        rgbaData[dstIdx + 2] = normalizedData[srcIdx];
        rgbaData[dstIdx + 3] = 255;
        break;
      case 2:
        // Grayscale with alpha
        rgbaData[dstIdx] = normalizedData[srcIdx];
        rgbaData[dstIdx + 1] = normalizedData[srcIdx];
        rgbaData[dstIdx + 2] = normalizedData[srcIdx];
        rgbaData[dstIdx + 3] = normalizedData[srcIdx + 1];
        break;
      case 3:
        // RGB: add alpha = 255
        rgbaData[dstIdx] = normalizedData[srcIdx];
        rgbaData[dstIdx + 1] = normalizedData[srcIdx + 1];
        rgbaData[dstIdx + 2] = normalizedData[srcIdx + 2];
        rgbaData[dstIdx + 3] = 255;
        break;
      case 4:
        // RGBA: copy as is
        rgbaData[dstIdx] = normalizedData[srcIdx];
        rgbaData[dstIdx + 1] = normalizedData[srcIdx + 1];
        rgbaData[dstIdx + 2] = normalizedData[srcIdx + 2];
        rgbaData[dstIdx + 3] = normalizedData[srcIdx + 3];
        break;
    }
  }

  // Create Jimp image from raw data
  const image = new Jimp({ width, height, data: Buffer.from(rgbaData) });

  // Write to file
  await image.write(filePath as `${string}.${string}`);
}
