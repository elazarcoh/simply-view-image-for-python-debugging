use do_notation::m;

use web_sys::*;

type TextureSrc = Vec<u8>;

#[derive(Default, Builder, Debug)]
#[builder(setter(into))]
pub struct TextureOptions {
    #[builder(default = "WebGl2RenderingContext::TEXTURE_2D")]
    target: u32,
    #[builder(default = "0")]
    level: u32,
    #[builder(default = "1")]
    width: u32,
    #[builder(default = "1")]
    height: u32,
    depth: u32,
    // min?: number;
    // mag?: number;
    // minMag?: number;
    #[builder(default = "None")]
    internal_format: Option<u32>,
    #[builder(default = "None")]
    format: Option<u32>,
    // type?: number;
    // wrap?: number;
    // wrapS?: number;
    // wrapT?: number;
    // wrapR?: number;
    // minLod?: number;
    // maxLod?: number;
    // baseLevel?: number;
    // maxLevel?: number;
    // unpackAlignment?: number;
    // color?: number[] | ArrayBufferView;
    // premultiplyAlpha?: number;
    // flipY?: number;
    // colorspaceConversion?: number;
    // auto?: boolean;
    // cubeFaceOrder?: number[];
    // src?: number[] | ArrayBufferView | TexImageSource | TexImageSource[] | string | string[] | TextureFunc;
    src: TextureSrc,
    // crossOrigin?: string;
}

fn create_texture(gl: &WebGl2RenderingContext, options: TextureOptions) {
    let tex = gl.create_texture();
    gl.bind_texture(options.target, tex.as_ref());
}

type Format = u32;
type DataType = u32;

#[derive(Clone)]
struct TextureInfo {
    texture_format: Format,
    color_renderable: bool,
    texture_filterable: bool,
    bytes_per_element: Vec<u8>,
    datatype: Vec<DataType>,
}

use std::collections::HashMap;

lazy_static! {
    static ref HASHMAP: HashMap<u32, &'static str> = {
        let mut m = HashMap::new();
        m.insert(
            WebGl2RenderingContext::ALPHA,
            TextureInfo {
                texture_format: WebGl2RenderingContext::ALPHA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![1, 2, 2, 4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE, WebGl2RenderingContext::HALF_FLOAT, WebGl2RenderingContext::HALF_FLOAT_OES, WebGl2RenderingContext::FLOAT],
            },
        );
        m
    };
}

// let s_textureInternalFormatInfo;
// function getTextureInternalFormatInfo(internalFormat) {
//   if (!s_textureInternalFormatInfo) {
//     // NOTE: these properties need unique names so we can let Uglify mangle the name.
//     const t = {};
//     // unsized formats
//     t[ALPHA]              = { textureFormat: ALPHA,           colorRenderable: true,  textureFilterable: true,  bytesPerElement: [1, 2, 2, 4],        type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT], };
//     t[LUMINANCE]          = { textureFormat: LUMINANCE,       colorRenderable: true,  textureFilterable: true,  bytesPerElement: [1, 2, 2, 4],        type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT], };
//     t[LUMINANCE_ALPHA]    = { textureFormat: LUMINANCE_ALPHA, colorRenderable: true,  textureFilterable: true,  bytesPerElement: [2, 4, 4, 8],        type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT], };
//     t[RGB]                = { textureFormat: RGB,             colorRenderable: true,  textureFilterable: true,  bytesPerElement: [3, 6, 6, 12, 2],    type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT, UNSIGNED_SHORT_5_6_5], };
//     t[RGBA]               = { textureFormat: RGBA,            colorRenderable: true,  textureFilterable: true,  bytesPerElement: [4, 8, 8, 16, 2, 2], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT, UNSIGNED_SHORT_4_4_4_4, UNSIGNED_SHORT_5_5_5_1], };
//     t[DEPTH_COMPONENT]    = { textureFormat: DEPTH_COMPONENT, colorRenderable: true,  textureFilterable: false, bytesPerElement: [2, 4],              type: [UNSIGNED_INT, UNSIGNED_SHORT], };

//     // sized formats
//     t[R8]                 = { textureFormat: RED,             colorRenderable: true,  textureFilterable: true,  bytesPerElement: [1],        type: [UNSIGNED_BYTE], };
//     t[R8_SNORM]           = { textureFormat: RED,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [1],        type: [BYTE], };
//     t[R16F]               = { textureFormat: RED,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [4, 2],     type: [FLOAT, HALF_FLOAT], };
//     t[R32F]               = { textureFormat: RED,             colorRenderable: false, textureFilterable: false, bytesPerElement: [4],        type: [FLOAT], };
//     t[R8UI]               = { textureFormat: RED_INTEGER,     colorRenderable: true,  textureFilterable: false, bytesPerElement: [1],        type: [UNSIGNED_BYTE], };
//     t[R8I]                = { textureFormat: RED_INTEGER,     colorRenderable: true,  textureFilterable: false, bytesPerElement: [1],        type: [BYTE], };
//     t[R16UI]              = { textureFormat: RED_INTEGER,     colorRenderable: true,  textureFilterable: false, bytesPerElement: [2],        type: [UNSIGNED_SHORT], };
//     t[R16I]               = { textureFormat: RED_INTEGER,     colorRenderable: true,  textureFilterable: false, bytesPerElement: [2],        type: [SHORT], };
//     t[R32UI]              = { textureFormat: RED_INTEGER,     colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [UNSIGNED_INT], };
//     t[R32I]               = { textureFormat: RED_INTEGER,     colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [INT], };
//     t[RG8]                = { textureFormat: RG,              colorRenderable: true,  textureFilterable: true,  bytesPerElement: [2],        type: [UNSIGNED_BYTE], };
//     t[RG8_SNORM]          = { textureFormat: RG,              colorRenderable: false, textureFilterable: true,  bytesPerElement: [2],        type: [BYTE], };
//     t[RG16F]              = { textureFormat: RG,              colorRenderable: false, textureFilterable: true,  bytesPerElement: [8, 4],     type: [FLOAT, HALF_FLOAT], };
//     t[RG32F]              = { textureFormat: RG,              colorRenderable: false, textureFilterable: false, bytesPerElement: [8],        type: [FLOAT], };
//     t[RG8UI]              = { textureFormat: RG_INTEGER,      colorRenderable: true,  textureFilterable: false, bytesPerElement: [2],        type: [UNSIGNED_BYTE], };
//     t[RG8I]               = { textureFormat: RG_INTEGER,      colorRenderable: true,  textureFilterable: false, bytesPerElement: [2],        type: [BYTE], };
//     t[RG16UI]             = { textureFormat: RG_INTEGER,      colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [UNSIGNED_SHORT], };
//     t[RG16I]              = { textureFormat: RG_INTEGER,      colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [SHORT], };
//     t[RG32UI]             = { textureFormat: RG_INTEGER,      colorRenderable: true,  textureFilterable: false, bytesPerElement: [8],        type: [UNSIGNED_INT], };
//     t[RG32I]              = { textureFormat: RG_INTEGER,      colorRenderable: true,  textureFilterable: false, bytesPerElement: [8],        type: [INT], };
//     t[RGB8]               = { textureFormat: RGB,             colorRenderable: true,  textureFilterable: true,  bytesPerElement: [3],        type: [UNSIGNED_BYTE], };
//     t[SRGB8]              = { textureFormat: RGB,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [3],        type: [UNSIGNED_BYTE], };
//     t[RGB565]             = { textureFormat: RGB,             colorRenderable: true,  textureFilterable: true,  bytesPerElement: [3, 2],     type: [UNSIGNED_BYTE, UNSIGNED_SHORT_5_6_5], };
//     t[RGB8_SNORM]         = { textureFormat: RGB,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [3],        type: [BYTE], };
//     t[R11F_G11F_B10F]     = { textureFormat: RGB,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [12, 6, 4], type: [FLOAT, HALF_FLOAT, UNSIGNED_INT_10F_11F_11F_REV], };
//     t[RGB9_E5]            = { textureFormat: RGB,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [12, 6, 4], type: [FLOAT, HALF_FLOAT, UNSIGNED_INT_5_9_9_9_REV], };
//     t[RGB16F]             = { textureFormat: RGB,             colorRenderable: false, textureFilterable: true,  bytesPerElement: [12, 6],    type: [FLOAT, HALF_FLOAT], };
//     t[RGB32F]             = { textureFormat: RGB,             colorRenderable: false, textureFilterable: false, bytesPerElement: [12],       type: [FLOAT], };
//     t[RGB8UI]             = { textureFormat: RGB_INTEGER,     colorRenderable: false, textureFilterable: false, bytesPerElement: [3],        type: [UNSIGNED_BYTE], };
//     t[RGB8I]              = { textureFormat: RGB_INTEGER,     colorRenderable: false, textureFilterable: false, bytesPerElement: [3],        type: [BYTE], };
//     t[RGB16UI]            = { textureFormat: RGB_INTEGER,     colorRenderable: false, textureFilterable: false, bytesPerElement: [6],        type: [UNSIGNED_SHORT], };
//     t[RGB16I]             = { textureFormat: RGB_INTEGER,     colorRenderable: false, textureFilterable: false, bytesPerElement: [6],        type: [SHORT], };
//     t[RGB32UI]            = { textureFormat: RGB_INTEGER,     colorRenderable: false, textureFilterable: false, bytesPerElement: [12],       type: [UNSIGNED_INT], };
//     t[RGB32I]             = { textureFormat: RGB_INTEGER,     colorRenderable: false, textureFilterable: false, bytesPerElement: [12],       type: [INT], };
//     t[RGBA8]              = { textureFormat: RGBA,            colorRenderable: true,  textureFilterable: true,  bytesPerElement: [4],        type: [UNSIGNED_BYTE], };
//     t[SRGB8_ALPHA8]       = { textureFormat: RGBA,            colorRenderable: true,  textureFilterable: true,  bytesPerElement: [4],        type: [UNSIGNED_BYTE], };
//     t[RGBA8_SNORM]        = { textureFormat: RGBA,            colorRenderable: false, textureFilterable: true,  bytesPerElement: [4],        type: [BYTE], };
//     t[RGB5_A1]            = { textureFormat: RGBA,            colorRenderable: true,  textureFilterable: true,  bytesPerElement: [4, 2, 4],  type: [UNSIGNED_BYTE, UNSIGNED_SHORT_5_5_5_1, UNSIGNED_INT_2_10_10_10_REV], };
//     t[RGBA4]              = { textureFormat: RGBA,            colorRenderable: true,  textureFilterable: true,  bytesPerElement: [4, 2],     type: [UNSIGNED_BYTE, UNSIGNED_SHORT_4_4_4_4], };
//     t[RGB10_A2]           = { textureFormat: RGBA,            colorRenderable: true,  textureFilterable: true,  bytesPerElement: [4],        type: [UNSIGNED_INT_2_10_10_10_REV], };
//     t[RGBA16F]            = { textureFormat: RGBA,            colorRenderable: false, textureFilterable: true,  bytesPerElement: [16, 8],    type: [FLOAT, HALF_FLOAT], };
//     t[RGBA32F]            = { textureFormat: RGBA,            colorRenderable: false, textureFilterable: false, bytesPerElement: [16],       type: [FLOAT], };
//     t[RGBA8UI]            = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [UNSIGNED_BYTE], };
//     t[RGBA8I]             = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [BYTE], };
//     t[RGB10_A2UI]         = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [UNSIGNED_INT_2_10_10_10_REV], };
//     t[RGBA16UI]           = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [8],        type: [UNSIGNED_SHORT], };
//     t[RGBA16I]            = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [8],        type: [SHORT], };
//     t[RGBA32I]            = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [16],       type: [INT], };
//     t[RGBA32UI]           = { textureFormat: RGBA_INTEGER,    colorRenderable: true,  textureFilterable: false, bytesPerElement: [16],       type: [UNSIGNED_INT], };
//     // Sized Internal
//     t[DEPTH_COMPONENT16]  = { textureFormat: DEPTH_COMPONENT, colorRenderable: true,  textureFilterable: false, bytesPerElement: [2, 4],     type: [UNSIGNED_SHORT, UNSIGNED_INT], };
//     t[DEPTH_COMPONENT24]  = { textureFormat: DEPTH_COMPONENT, colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [UNSIGNED_INT], };
//     t[DEPTH_COMPONENT32F] = { textureFormat: DEPTH_COMPONENT, colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [FLOAT], };
//     t[DEPTH24_STENCIL8]   = { textureFormat: DEPTH_STENCIL,   colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [UNSIGNED_INT_24_8], };
//     t[DEPTH32F_STENCIL8]  = { textureFormat: DEPTH_STENCIL,   colorRenderable: true,  textureFilterable: false, bytesPerElement: [4],        type: [FLOAT_32_UNSIGNED_INT_24_8_REV], };

//     Object.keys(t).forEach(function(internalFormat) {
//       const info = t[internalFormat];
//       info.bytesPerElementMap = {};
//       info.bytesPerElement.forEach(function(bytesPerElement, ndx) {
//         const type = info.type[ndx];
//         info.bytesPerElementMap[type] = bytesPerElement;
//       });
//     });
//     s_textureInternalFormatInfo = t;
//   }
//   return s_textureInternalFormatInfo[internalFormat];
// }

// function getFormatAndTypeForInternalFormat(internalFormat) {
//   const info = getTextureInternalFormatInfo(internalFormat);
//   if (!info) {
//     throw "unknown internal format";
//   }
//   return {
//     format: info.textureFormat,
//     type: info.type[0],
//   };
// }

fn set_texture_from_array(
    gl: &WebGl2RenderingContext,
    tex: &WebGlTexture,
    src: TextureSrc,
    options: TextureOptions,
) {
    gl.bind_texture(options.target, Some(tex));
    let width = options.width;
    let height = options.height;
    let depth = options.depth;
    let level = options.level;
    let internal_format = options
        .internal_format
        .unwrap_or(options.format.unwrap_or(WebGl2RenderingContext::RGBA));
}
