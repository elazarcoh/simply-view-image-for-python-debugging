// based on twgl

use do_notation::m;
use std::mem;

use std::ops::Deref;

use wasm_bindgen::{JsCast, JsValue};
use web_sys::*;
use web_sys::{WebGl2RenderingContext as GL, WebGl2RenderingContext};

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
    static ref FORMAT_INFO: HashMap<u32, TextureInfo> = {
        let mut m = HashMap::new();
        m.insert(
            WebGl2RenderingContext::ALPHA,
            TextureInfo {
                texture_format: WebGl2RenderingContext::ALPHA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![1, 2, 4],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::LUMINANCE,
            TextureInfo {
                texture_format: WebGl2RenderingContext::LUMINANCE,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![1, 2, 4],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::LUMINANCE_ALPHA,
            TextureInfo {
                texture_format: WebGl2RenderingContext::LUMINANCE_ALPHA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![2, 4, 8],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![3, 6, 12, 2],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::UNSIGNED_SHORT_5_6_5,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![4, 8, 16, 2, 2],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::UNSIGNED_SHORT_4_4_4_4,
                    WebGl2RenderingContext::UNSIGNED_SHORT_5_5_5_1,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::DEPTH_COMPONENT,
            TextureInfo {
                texture_format: WebGl2RenderingContext::DEPTH_COMPONENT,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![2, 4],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_INT,
                    WebGl2RenderingContext::UNSIGNED_SHORT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::R8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![1],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::R8_SNORM,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![1],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::R16F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![4, 2],
                datatype: vec![
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::HALF_FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::R32F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::FLOAT],
            },
        );
        m.insert(
            WebGl2RenderingContext::R8UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![1],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::R8I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![1],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::R16UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![2],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::R16I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![2],
                datatype: vec![WebGl2RenderingContext::SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::R32UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::R32I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RED_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![2],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG8_SNORM,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![2],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG16F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![8, 4],
                datatype: vec![
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::HALF_FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG32F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![8],
                datatype: vec![WebGl2RenderingContext::FLOAT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG8UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![2],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG8I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![2],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG16UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG16I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG32UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![8],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RG32I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RG_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![8],
                datatype: vec![WebGl2RenderingContext::INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![3],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::SRGB8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![3],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB565,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![3, 2],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::UNSIGNED_SHORT_5_6_5,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB8_SNORM,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![3],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::R11F_G11F_B10F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![12, 6, 4],
                datatype: vec![
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::UNSIGNED_INT_10F_11F_11F_REV,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB9_E5,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![12, 6, 4],
                datatype: vec![
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::HALF_FLOAT,
                    WebGl2RenderingContext::UNSIGNED_INT_5_9_9_9_REV,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB16F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![12, 6],
                datatype: vec![
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::HALF_FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB32F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![12],
                datatype: vec![WebGl2RenderingContext::FLOAT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB8UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB_INTEGER,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![3],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB8I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB_INTEGER,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![3],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB16UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB_INTEGER,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![6],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB16I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB_INTEGER,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![6],
                datatype: vec![WebGl2RenderingContext::SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB32UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB_INTEGER,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![12],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB32I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGB_INTEGER,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![12],
                datatype: vec![WebGl2RenderingContext::INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::SRGB8_ALPHA8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA8_SNORM,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB5_A1,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![4, 2, 4],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::UNSIGNED_SHORT_5_5_5_1,
                    WebGl2RenderingContext::UNSIGNED_INT_2_10_10_10_REV,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA4,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![4, 2],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_BYTE,
                    WebGl2RenderingContext::UNSIGNED_SHORT_4_4_4_4,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB10_A2,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: true,
                texture_filterable: true,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT_2_10_10_10_REV],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA16F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: false,
                texture_filterable: true,
                bytes_per_element: vec![16, 8],
                datatype: vec![
                    WebGl2RenderingContext::FLOAT,
                    WebGl2RenderingContext::HALF_FLOAT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA32F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA,
                color_renderable: false,
                texture_filterable: false,
                bytes_per_element: vec![16],
                datatype: vec![WebGl2RenderingContext::FLOAT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA8UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA8I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::BYTE],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGB10_A2UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT_2_10_10_10_REV],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA16UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![8],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA16I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![8],
                datatype: vec![WebGl2RenderingContext::SHORT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA32I,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![16],
                datatype: vec![WebGl2RenderingContext::INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::RGBA32UI,
            TextureInfo {
                texture_format: WebGl2RenderingContext::RGBA_INTEGER,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![16],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::DEPTH_COMPONENT16,
            TextureInfo {
                texture_format: WebGl2RenderingContext::DEPTH_COMPONENT,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![2, 4],
                datatype: vec![
                    WebGl2RenderingContext::UNSIGNED_SHORT,
                    WebGl2RenderingContext::UNSIGNED_INT,
                ],
            },
        );
        m.insert(
            WebGl2RenderingContext::DEPTH_COMPONENT24,
            TextureInfo {
                texture_format: WebGl2RenderingContext::DEPTH_COMPONENT,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT],
            },
        );
        m.insert(
            WebGl2RenderingContext::DEPTH_COMPONENT32F,
            TextureInfo {
                texture_format: WebGl2RenderingContext::DEPTH_COMPONENT,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::FLOAT],
            },
        );
        m.insert(
            WebGl2RenderingContext::DEPTH24_STENCIL8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::DEPTH_STENCIL,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::UNSIGNED_INT_24_8],
            },
        );
        m.insert(
            WebGl2RenderingContext::DEPTH32F_STENCIL8,
            TextureInfo {
                texture_format: WebGl2RenderingContext::DEPTH_STENCIL,
                color_renderable: true,
                texture_filterable: false,
                bytes_per_element: vec![4],
                datatype: vec![WebGl2RenderingContext::FLOAT_32_UNSIGNED_INT_24_8_REV],
            },
        );

        m
    };
}

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
    let format_info = FORMAT_INFO.get(&internal_format);
}

type GLConstant = u32;

pub struct ProgramBundle {
    pub program: WebGlProgram,
    pub shaders: Vec<WebGlShader>,
}

fn check_shader_status(
    gl: &GL,
    shader_type: GLConstant,
    shader: &WebGlShader,
) -> Result<(), String> {
    // Check the compile status
    let compiled = gl.get_shader_parameter(shader, GL::COMPILE_STATUS);
    if !compiled {
        let shader_type_str = match shader_type {
            GL::VERTEX_SHADER => "vertex",
            GL::FRAGMENT_SHADER => "fragment",
            _ => "unknown",
        };
        // Something went wrong during compilation; get the error
        let last_error = gl.get_shader_info_log(shader);
        let shader_source = gl.get_shader_source(shader);
        let msg = format!(
            "Error compiling `{}` shader: {}\nsource:\n{}",
            shader_type_str,
            last_error.unwrap_or("unknown error".to_string()),
            shader_source.unwrap_or("unknown source".to_string())
        );
        Err(msg)
    } else {
        Ok(())
    }
}

fn validate_program(gl: &GL, program: &WebGlProgram) -> Result<(), String> {
    // Check the link status
    gl.validate_program(program);

    let linked = gl
        .get_program_parameter(&program, GL::LINK_STATUS)
        .as_bool()
        .unwrap();

    if !linked {
        let last_error = gl.get_program_info_log(program);
        let errors = gl
            .get_attached_shaders(program)
            .ok_or("Could not get attached shaders")?
            .iter()
            .map(|shader| {
                let shader: &WebGlShader = shader.dyn_ref::<WebGlShader>().unwrap();
                check_shader_status(
                    &gl,
                    gl.get_shader_parameter(shader, GL::SHADER_TYPE)
                        .as_f64()
                        .unwrap() as GLConstant,
                    shader,
                )
            })
            .filter(|result| result.is_err())
            .map(|result| result.unwrap_err())
            .collect::<Vec<_>>();

        let message = format!(
            "{}\n{}",
            last_error.unwrap_or("unknown error".to_string()),
            errors
                .iter()
                .map(|error| error.to_string())
                .collect::<Vec<_>>()
                .join("\n")
        );

        Err(message)
    } else {
        Ok(())
    }
}

pub trait GLDrop {
    fn drop(&self, gl: &GL);
}

impl GLDrop for WebGlProgram {
    fn drop(&self, gl: &GL) {
        gl.delete_program(Some(self));
    }
}

impl GLDrop for WebGlShader {
    fn drop(&self, gl: &GL) {
        gl.delete_shader(Some(self));
    }
}

impl GLDrop for WebGlBuffer {
    fn drop(&self, gl: &GL) {
        gl.delete_buffer(Some(self));
    }
}

impl GLDrop for ProgramBundle {
    fn drop(&self, gl: &GL) {
        self.program.drop(gl);
        self.shaders.iter().for_each(|shader| shader.drop(gl));
    }
}

pub struct GLGuard<T: GLDrop> {
    gl: GL,
    obj: T,
}

impl<T: GLDrop> Drop for GLGuard<T> {
    fn drop(&mut self) {
        self.obj.drop(&self.gl);
    }
}

impl<T: GLDrop> Deref for GLGuard<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.obj
    }
}

fn gl_guarded<T: GLDrop, E>(gl: GL, f: impl FnOnce(&GL) -> Result<T, E>) -> Result<GLGuard<T>, E> {
    f(&gl).map(move |obj| GLGuard { gl, obj })
}

fn take_into_owned<T: GLDrop + JsCast>(mut guard: GLGuard<T>) -> T {
    mem::replace(&mut guard.obj, JsCast::unchecked_into(JsValue::UNDEFINED))
}

fn create_program(
    gl: &GL,
    vertex_shader: &str,
    fragment_shader: &str,
    opt_attribs: Option<Vec<&str>>,
) -> Result<GLGuard<ProgramBundle>, String> {
    let binding = opt_attribs.unwrap_or(vec![]);
    let attribute_locations = binding.iter().enumerate().collect::<Vec<(usize, &&str)>>();

    let program = gl_guarded(gl.clone(), |gl| {
        gl.create_program().ok_or("Could not create program")
    })?;

    let gl_vertex_shader = gl_guarded(gl.clone(), |gl| {
        gl.create_shader(WebGl2RenderingContext::VERTEX_SHADER)
            .ok_or("Could not create vertex shader")
            .map(|shader| {
                gl.shader_source(&shader, vertex_shader);
                gl.compile_shader(&shader);
                gl.attach_shader(&program, &shader);
                shader
            })
    })?;

    let gl_fragment_shader = gl_guarded(gl.clone(), |gl| {
        gl.create_shader(WebGl2RenderingContext::FRAGMENT_SHADER)
            .ok_or("Could not create fragment shader")
            .map(|shader| {
                gl.shader_source(&shader, fragment_shader);
                gl.compile_shader(&shader);
                gl.attach_shader(&program, &shader);
                shader
            })
    })?;

    let bounded_attributes = attribute_locations.iter().for_each(|(i, name)| {
        gl.bind_attrib_location(&program, *i as u32, name);
    });

    gl.link_program(&program);

    validate_program(gl, &program)?;

    Ok(GLGuard {
        gl: gl.clone(),
        obj: ProgramBundle {
            program: take_into_owned(program),
            shaders: vec![
                take_into_owned(gl_vertex_shader),
                take_into_owned(gl_fragment_shader),
            ],
        },
    })
}

#[derive(Debug, Builder)]
#[builder(
    pattern = "owned",
    custom_constructor,
    create_empty = "empty",
    build_fn(
        private,
        name = "fallible_build",
        error = "::derive_builder::UninitializedFieldError"
    )
)]
pub struct GLProgramBuilder<'a> {
    #[builder(setter(custom))]
    gl: &'a GL,

    vertex_shader: &'a str,
    fragment_shader: &'a str,

    #[builder(setter(each(name = "attribute")))]
    attributes: Vec<&'a str>,
}

impl<'a> GLProgramBuilder<'a> {
    pub fn new<'b>(gl: &'b GL) -> GLProgramBuilderBuilder<'b> {
        GLProgramBuilderBuilder {
            gl: Some(gl),
            ..GLProgramBuilderBuilder::empty()
        }
    }
}

impl<'a> GLProgramBuilderBuilder<'a> {
    pub fn build(self) -> Result<GLGuard<ProgramBundle>, String> {
        self.fallible_build()
            .map_err(|e| format!("GLProgramBuilder error: {}", e))
            .and_then(|b| {
                create_program(b.gl, b.vertex_shader, b.fragment_shader, Some(b.attributes))
            })
    }
}

/**
 * Creates setter functions for all uniforms of a shader
 * program.
 *
 * @see {@link module:twgl.setUniforms}
 *
 * @param {WebGLProgram} program the program to create setters for.
 * @returns {Object.<string, function>} an object with a setter by name for each uniform
 * @memberOf module:twgl/programs
 */
fn createUniformSetters(gl: &GL, program: &WebGlProgram) {
    // let textureUnit = 0;

    // /**
    //  * Creates a setter for a uniform of the given program with it's
    //  * location embedded in the setter.
    //  * @param {WebGLProgram} program
    //  * @param {WebGLUniformInfo} uniformInfo
    //  * @returns {function} the created setter.
    //  */
    // let s: HashMap<String, GLSetter> = HashMap::new();
    // let createUniformSetter = |program, uniformInfo| {
    //     //     let location = gl.get_uniform_location(program, uniformInfo.name);
    //     //   var isArray = (uniformInfo.size > 1 && uniformInfo.name.substr(-3) === "[0]");
    //     //   var type = uniformInfo.type;
    //     //   var typeInfo = typeMap[type];
    //     //   if (!typeInfo) {
    //     //     throw ("unknown type: 0x" + type.toString(16)); // we should never get here.
    //     //   }
    //     //   if (typeInfo.bindPoint) {
    //     //     // it's a sampler
    //     //     var unit = textureUnit;
    //     //     textureUnit += uniformInfo.size;

    //     //     if (isArray) {
    //     //       return typeInfo.arraySetter(gl, type, unit, location, uniformInfo.size);
    //     //     } else {
    //     //       return typeInfo.setter(gl, type, unit, location, uniformInfo.size);
    //     //     }
    //     //   } else {
    //     //     if (typeInfo.arraySetter && isArray) {
    //     //       return typeInfo.arraySetter(gl, location);
    //     //     } else {
    //     //       return typeInfo.setter(gl, location);
    //     //     }
    //     //   }
    // };
    // let uniformSetters: HashMap<String, fn()> = HashMap::new();
    // let numUniforms = gl
    //     .get_program_parameter(program, GL::ACTIVE_UNIFORMS)
    //     .as_f64()
    //     .unwrap() as u32;

    // for ii in 0..numUniforms {
    //     let uniformInfo = gl
    //         .get_active_uniform(program, ii)
    //         .ok_or("Could not get uniform info")?;

    //     let name = uniformInfo.name();
    //     // remove the array suffix.
    //     // - uniforms end with '[0]'
    //     let name = if name.ends_with("[0]") {
    //         &name[..name.len() - 3]
    //     } else {
    //         &name
    //     };
    //     let setter = createUniformSetter(program, uniformInfo);
    //     uniformSetters[name] = setter;
    // }
    // // return uniformSetters;
}

// pub fn createProgramInfo(
//     gl: GL,
//     shaderSources: Vec<String>,
//     opt_attribs: Option<Vec<String>>,
// ) -> ProgramInfo {
//     //   let progOptions = getProgramOptions(opt_attribs, opt_locations, opt_errorCallback);
//     //   const errors = [];
//     //   shaderSources = shaderSources.map(function(source) {
//     //     // Lets assume if there is no \n it's an id
//     //     if (!notIdRE.test(source)) {
//     //       const script = getElementById(source);
//     //       if (!script) {
//     //         const err = `no element with id: ${source}`;
//     //         progOptions.errorCallback(err);
//     //         errors.push(err);
//     //       } else {
//     //         source = script.text;
//     //       }
//     //     }
//     //     return source;
//     //   });

//     //   if (errors.length) {
//     //     return reportError(progOptions, '');
//     //   }

//     //   const origCallback = progOptions.callback;
//     //   if (origCallback) {
//     //     progOptions.callback = (err, program) => {
//     //       origCallback(err, err ? undefined : createProgramInfoFromProgram(gl, program));
//     //     };
//     //   }

//     //   const program = createProgramFromSources(gl, shaderSources, progOptions);
//     //   if (!program) {
//     //     return null;
//     //   }

//     //   return createProgramInfoFromProgram(gl, program);
// }
