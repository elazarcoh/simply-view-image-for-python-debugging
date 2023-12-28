import { configUtils } from "vscode-extensions-json-generator/utils";

export enum Backends {
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

// need to export Config for the package.json to automatically update
// ts-unused-exports:disable-next-line
export interface Config {
    /**
     * @default true
     * @description Use the system tmp path to save image otherwise use the storage path.
     * @deprecated true
     * @deprecationMessage Use `svifpd.saveLocation` instead.
     */
    useTmpPathToSave: boolean;

    /**
     * @default "tmp"
     * @description Location to save images.
     */
    saveLocation: "tmp" | "extensionStorage" | "custom";

    /**
     * @default undefined
     * @description Custom path to save images. Only used if `svifpd.saveLocation` is set to `custom`.
     * @requires svifpd.saveLocation = "custom"
     */
    customSavePath: string | undefined;

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
     * @default "none"
     * @description Enable debug mode (show debug info in `View Image for Python` output)
     */
    debug: "none" | "debug" | "verbose";

    /**
     * @default true
     * @description Whether to show a context menu entry in VSCode debug variables view for custom objects (currently only plots).
     */
    addViewContextEntryToVSCodeDebugVariables: boolean;

    /**
     * @default false
     * @description Whether to allow plugins to register their own viewables.
     */
    allowPlugins: boolean;

    /**
     * @default true
     * @description Whether to use the new experimental viewer.
     * @experimental
     */
    useExperimentalViewer: boolean;

    /**
     * @default true
     * @description Whether to use the new data-transfer protocol (using a socket server, instead of a file).
     * @experimental
     */
    useExperimentalDataTransfer: boolean;
}

export const EXTENSION_CONFIG_SECTION = "svifpd";
export const getConfiguration = configUtils.ConfigurationGetter<Config>(
    EXTENSION_CONFIG_SECTION
);
