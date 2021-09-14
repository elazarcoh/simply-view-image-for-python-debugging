import { configUtils } from "vscode-extension-config";

export enum Backends {
  skimage = "skimage",
  opencv = "opencv",
  imageio = "imageio",
  Pillow = "Pillow",
  Standalone = "Standalone",
}

export enum NormalizationMethods {
  normalize = "normalize",
  skimage_img_as_ubyte = "skimage.img_as_ubyte",
  None = "None",
}

export enum WatchServices {
  Images = "images",
  Plots = "plots",
  ImageTensors = "image-tensors",
}
export interface ImageViewConfig {
  preferredBackend: Backends;
  normalizationMethod: NormalizationMethods;
}

export interface Config {
  /**
   * @default true
   * @description Use the system tmp path to save image otherwise use the storage path.
   */
  useTmpPathToSave: boolean;

  /**
   * @default "Standalone"
   * @description Preferred backend package to save the image with. Automatically falls back to one of the other.
   */
  preferredBackend: Backends;

  /**
   * @enumDescriptions [
        "First subtracts the minimal value, and then scale the values between [0, 255]",
        "Negative input values will be clipped. Positive values are scaled between 0 and 255.",
        "Image saved as is, behavior as specified for the backend."]
   * @default "normalize"
   * @description Image normalization method: The image pixels must be in [0, 255] to be saved correctly. For that, we perform a normalization before save is being called. For more information, see the description for each method.
   */
  normalizationMethod: NormalizationMethods;

  /**
   * @default true
   * @description Restrict image types to numpy.ndarray/PIL.Image only
   */
  restrictImageTypes: boolean;

  /**
   * @default false
   * @description Whether to run matplotlib.use('agg') to avoid display error. Can be useful for working remotely over ssh etc.
   */
  matplotlibUseAgg: boolean;

  /**
   * @default true
   * @description Use the extension to track images (reshow the image at each debugger step)
   */
  "imageWatch.enable": boolean;

  /**
   * @default ["images"]
   * @uniqueItems true
   */
  "imageWatch.objects": WatchServices[];
}

const section = "svifpd";
export const getConfiguration = configUtils.ConfigurationGetter<Config>(section);
