import * as vscode from 'vscode';
import { stringToEnumValue } from './utils';


export enum backends {
    skimage = "skimage",
    opencv = "opencv",
    imageio = "imageio",
    Pillow = "Pillow",
    Standalone = "Standalone"
}

export enum normalizationMethods {
    normalize = "normalize",
    skimage_img_as_ubyte = "skimage.img_as_ubyte",
    None = "None"
}

export interface ImageViewConfig {
    preferredBackend: backends,
    normalizationMethod: normalizationMethods,
}

export function currentConfigurations(): ImageViewConfig {
    const preferredBackend = vscode.workspace.getConfiguration("svifpd").get("preferredBackend", backends.Standalone);
    const normalizationMethod = vscode.workspace.getConfiguration("svifpd").get("normalizationMethod", normalizationMethods.normalize);
    const config: ImageViewConfig = {
        preferredBackend: stringToEnumValue(backends, preferredBackend)!,
        normalizationMethod: stringToEnumValue(normalizationMethods, normalizationMethod)!,
    };
    return config;
}
