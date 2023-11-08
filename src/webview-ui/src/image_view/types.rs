use std::{convert::TryFrom, fmt::Display};

use image::DynamicImage;

use crate::{
    common::Size,
    communication::incoming_messages::ImageData,
    webgl_utils::{self, types::GLGuard},
};

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ImageId(String);

impl Display for ImageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl ImageId {
    pub fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        Self(uuid.to_string())
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum ViewId {
    Primary,
}

pub fn all_views() -> Vec<ViewId> {
    vec![ViewId::Primary]
}

#[derive(Debug)]
pub struct TextureImage {
    pub image: crate::communication::incoming_messages::ImageData,
    pub texture: GLGuard<web_sys::WebGlTexture>,
}

impl TextureImage {
    pub fn try_new(
        image: crate::communication::incoming_messages::ImageData,
        gl: &web_sys::WebGl2RenderingContext,
    ) -> Result<Self, String> {
        let texture = create_texture_from_image_data(
            gl,
            &image,
            webgl_utils::types::CreateTextureParametersBuilder::default()
                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                .build()
                .unwrap(),
        )?;
        Ok(Self { image, texture })
    }

    pub fn image_size(&self) -> Size {
        Size {
            width: self.image.info.width as f32,
            height: self.image.info.height as f32,
        }
    }
}

// TODO: move from here
use crate::communication::incoming_messages::Datatype;
use webgl_utils::types::{ElementType, Format, InternalFormat};
#[rustfmt::skip]
lazy_static! {
    static ref FORMAT_AND_TYPE_FOR_DATATYPE_AND_CHANNELS: std::collections::HashMap<(Datatype, u32), (InternalFormat, Format, ElementType)> = {
        let mut m = std::collections::HashMap::new();
        // rustfmt 
        m.insert((Datatype::Uint8, 1), (InternalFormat::Luminance, Format::Luminance, ElementType::UnsignedByte));
        m.insert((Datatype::Uint8, 2), (InternalFormat::Rg8, Format::Rg, ElementType::UnsignedByte));
        m.insert((Datatype::Uint8, 3), (InternalFormat::Rgb8, Format::Rgb, ElementType::UnsignedByte));
        m.insert((Datatype::Uint8, 4), (InternalFormat::Rgba8, Format::Rgba, ElementType::UnsignedByte));
        m.insert((Datatype::Uint16, 4), (InternalFormat::Rgba4, Format::RgbaInteger, ElementType::UnsignedShort));
        m.insert((Datatype::Float32, 1), (InternalFormat::R32F, Format::Red, ElementType::Float));
        m.insert((Datatype::Float32, 2), (InternalFormat::Rg32F, Format::Rg, ElementType::Float));
        m.insert((Datatype::Float32, 3), (InternalFormat::Rgb32F, Format::Rgb, ElementType::Float));
        m.insert((Datatype::Float32, 4), (InternalFormat::Rgba32F, Format::Rgba, ElementType::Float));

        m
    };
}

fn typed_array_from_bytes(
    bytes: &[u8],
    element_type: ElementType,
) -> Result<js_sys::Object, String> {
    let array_buffer = js_sys::Uint8Array::from(bytes).buffer();
    let array = match element_type {
        ElementType::Byte => js_sys::Int8Array::new(&array_buffer).into(),
        ElementType::UnsignedByte => js_sys::Uint8Array::new(&array_buffer).into(),
        ElementType::Short => js_sys::Int16Array::new(&array_buffer).into(),
        ElementType::UnsignedShort => js_sys::Uint16Array::new(&array_buffer).into(),
        ElementType::Int => js_sys::Int32Array::new(&array_buffer).into(),
        ElementType::UnsignedInt => js_sys::Uint32Array::new(&array_buffer).into(),
        ElementType::Float => js_sys::Float32Array::new(&array_buffer).into(),
    };
    Ok(array)
}

fn create_texture_from_image_data(
    gl: &web_sys::WebGl2RenderingContext,
    image: &crate::communication::incoming_messages::ImageData,
    parameters: webgl_utils::CreateTextureParameters,
) -> Result<GLGuard<web_sys::WebGlTexture>, String> {
    let tex = webgl_utils::gl_guarded(gl.clone(), |gl| {
        gl.create_texture().ok_or("Could not create texture")
    })?;
    let width = image.info.width;
    let height = image.info.height;
    gl.bind_texture(webgl_utils::TextureTarget::Texture2D as _, Some(&tex));
    let (internal_format, format, type_) = *FORMAT_AND_TYPE_FOR_DATATYPE_AND_CHANNELS
        .get(&(image.info.datatype, image.info.channels))
        .ok_or_else(|| {
            format!(
                "Could not find internal format for datatype {:?} and channels {}",
                image.info.datatype, image.info.channels
            )
        })?;
    gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_array_buffer_view_and_src_offset(
        webgl_utils::TextureTarget::Texture2D as _,
        0,
        internal_format as _,
        width as i32,
        height as i32,
        0,
        format as _,
        type_ as _,
        &typed_array_from_bytes(&image.bytes, type_)?,
        0,
    )
    .map_err(|jsvalue| format!("Could not create texture from image: {:?}", jsvalue))?;

    if let Some(mag_filter) = parameters.mag_filter {
        gl.tex_parameteri(
            webgl_utils::TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            mag_filter as i32,
        );
    }
    if let Some(min_filter) = parameters.min_filter {
        gl.tex_parameteri(
            webgl_utils::TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_MIN_FILTER,
            min_filter as i32,
        );
    }
    if let Some(wrap_s) = parameters.wrap_s {
        gl.tex_parameteri(
            webgl_utils::TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_WRAP_S,
            wrap_s as i32,
        );
    }
    if let Some(wrap_t) = parameters.wrap_t {
        gl.tex_parameteri(
            webgl_utils::TextureTarget::Texture2D as _,
            web_sys::WebGl2RenderingContext::TEXTURE_WRAP_T,
            wrap_t as i32,
        );
    }

    Ok(tex)
}
