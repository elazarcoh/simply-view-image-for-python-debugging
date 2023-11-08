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
    #[builder(default = "WebGl2RenderingContext::RGBA")]
    internal_format: u32,
    // format?: number;
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
    src : TextureSrc,
    // crossOrigin?: string;
}

fn create_texture(gl: &WebGl2RenderingContext, options: TextureOptions) {
    let tex = gl.create_texture();
    gl.bind_texture(options.target, tex.as_ref());

}

fn set_texture_from_array(gl: &WebGl2RenderingContext, tex: &WebGlTexture, src: TextureSrc, options: TextureOptions) {

    gl.bind_texture(options.target, Some(tex));

}