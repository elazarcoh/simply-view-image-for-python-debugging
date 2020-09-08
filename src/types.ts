
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