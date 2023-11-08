use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

// TODO: move Datatype to a more general place
use crate::communication::incoming_messages::Datatype;

use super::types::*;
use super::utils::js_typed_array_from_bytes;

// TODO: move from here

#[rustfmt::skip]
lazy_static! {
    static ref FORMAT_AND_TYPE_FOR_DATATYPE_AND_CHANNELS: std::collections::HashMap<(Datatype, u32), (InternalFormat, Format, ElementType)> = {
        let mut m = std::collections::HashMap::new();
        // rustfmt 
        m.insert((Datatype::Uint8, 1), (InternalFormat::R8UI, Format::RedInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Uint8, 2), (InternalFormat::RG8UI, Format::RgInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Uint8, 3), (InternalFormat::RGB8UI, Format::RgbInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Uint8, 4), (InternalFormat::RGBA8UI, Format::RgbaInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Int8, 1), (InternalFormat::R8I, Format::RedInteger, ElementType::Byte));
        m.insert((Datatype::Int8, 2), (InternalFormat::RG8I, Format::RgInteger, ElementType::Byte));
        m.insert((Datatype::Int8, 3), (InternalFormat::RGB8I, Format::RgbInteger, ElementType::Byte));
        m.insert((Datatype::Int8, 4), (InternalFormat::RGBA8I, Format::RgbaInteger, ElementType::Byte));
        m.insert((Datatype::Uint16, 1), (InternalFormat::R16UI, Format::RedInteger, ElementType::UnsignedShort));
        m.insert((Datatype::Uint16, 2), (InternalFormat::RG16UI, Format::RgInteger, ElementType::UnsignedShort));
        m.insert((Datatype::Uint16, 3), (InternalFormat::RGB16UI, Format::RgbInteger, ElementType::UnsignedShort));
        m.insert((Datatype::Uint16, 4), (InternalFormat::RGBA16UI, Format::RgbaInteger, ElementType::UnsignedShort));
        m.insert((Datatype::Int16, 1), (InternalFormat::R16I, Format::RedInteger, ElementType::Short));
        m.insert((Datatype::Int16, 2), (InternalFormat::RG16I, Format::RgInteger, ElementType::Short));
        m.insert((Datatype::Int16, 3), (InternalFormat::RGB16I, Format::RgbInteger, ElementType::Short));
        m.insert((Datatype::Int16, 4), (InternalFormat::RGBA16I, Format::RgbaInteger, ElementType::Short));
        m.insert((Datatype::Uint32, 1), (InternalFormat::R32UI, Format::RedInteger, ElementType::UnsignedInt));
        m.insert((Datatype::Uint32, 2), (InternalFormat::RG32UI, Format::RgInteger, ElementType::UnsignedInt));
        m.insert((Datatype::Uint32, 3), (InternalFormat::RGB32UI, Format::RgbInteger, ElementType::UnsignedInt));
        m.insert((Datatype::Uint32, 4), (InternalFormat::RGBA32UI, Format::RgbaInteger, ElementType::UnsignedInt));
        m.insert((Datatype::Int32, 1), (InternalFormat::R32I, Format::RedInteger, ElementType::Int));
        m.insert((Datatype::Int32, 2), (InternalFormat::RG32I, Format::RgInteger, ElementType::Int));
        m.insert((Datatype::Int32, 3), (InternalFormat::RGB32I, Format::RgbInteger, ElementType::Int));
        m.insert((Datatype::Int32, 4), (InternalFormat::RGBA32I, Format::RgbaInteger, ElementType::Int));
        m.insert((Datatype::Float32, 1), (InternalFormat::R32F, Format::Red, ElementType::Float));
        m.insert((Datatype::Float32, 2), (InternalFormat::RG32F, Format::RG, ElementType::Float));
        m.insert((Datatype::Float32, 3), (InternalFormat::RGB32F, Format::Rgb, ElementType::Float));
        m.insert((Datatype::Float32, 4), (InternalFormat::RGBA32F, Format::Rgba, ElementType::Float));
        m.insert((Datatype::Bool, 1), (InternalFormat::R8UI, Format::RedInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Bool, 2), (InternalFormat::RG8UI, Format::RgInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Bool, 3), (InternalFormat::RGB8UI, Format::RgbInteger, ElementType::UnsignedByte));
        m.insert((Datatype::Bool, 4), (InternalFormat::RGBA8UI, Format::RgbaInteger, ElementType::UnsignedByte));

        m
    };
}

pub(crate) fn create_texture_from_bytes(
    gl: &web_sys::WebGl2RenderingContext,
    bytes: &[u8],
    width: u32,
    height: u32,
    channels: u8,
    datatype: Datatype,
    parameters: CreateTextureParameters,
) -> Result<GLGuard<web_sys::WebGlTexture>, String> {
    let tex = gl_guarded(gl.clone(), |gl| {
        gl.create_texture().ok_or("Could not create texture")
    })?;
    gl.bind_texture(TextureTarget::Texture2D as _, Some(&tex));
    let (internal_format, format, type_) = *FORMAT_AND_TYPE_FOR_DATATYPE_AND_CHANNELS
        .get(&(datatype, channels as _))
        .ok_or_else(|| {
            format!(
                "Could not find internal format for datatype {:?} and channels {}",
                datatype, channels,
            )
        })?;
    gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_array_buffer_view_and_src_offset(
        TextureTarget::Texture2D as _,
        0,
        internal_format as _,
        width as i32,
        height as i32,
        0,
        format as _,
        type_ as _,
        &js_typed_array_from_bytes(bytes, type_)?,
        0,
    )
    .map_err(|jsvalue| format!("Could not create texture from image: {:?}", jsvalue))?;

    if let Some(mag_filter) = parameters.mag_filter {
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            mag_filter as i32,
        );
    }
    if let Some(min_filter) = parameters.min_filter {
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_MIN_FILTER,
            min_filter as i32,
        );
    }
    if let Some(wrap_s) = parameters.wrap_s {
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_WRAP_S,
            wrap_s as i32,
        );
    }
    if let Some(wrap_t) = parameters.wrap_t {
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_WRAP_T,
            wrap_t as i32,
        );
    }

    Ok(tex)
}
