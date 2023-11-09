use std::fmt::Display;

use crate::communication::incoming_messages::{Datatype, LocalImageData};
use bytemuck::Pod;
use glam::UVec2;
use strum::EnumCount;
use webgl_utils::types::{ElementType, Format, InternalFormat};

use crate::{
    common::Size,
    communication::incoming_messages::Channels,
    webgl_utils::{self, types::GLGuard},
};

static_assertions::const_assert_eq!(Channels::COUNT, 4); // If this is failing, you need to update the code below

#[derive(Copy, Clone, Debug, PartialEq)]
pub(crate) struct PixelValue {
    pub num_channels: Channels,
    pub datatype: Datatype,
    pub bytes: [u8; 32], // we need at most: 4 channels * 8 bytes per channel
}

impl Display for PixelValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let datatype = self.datatype;
        write!(f, "(")?;
        let mut sep = "";
        (0..self.num_channels.into())
            .map(|c| -> std::fmt::Result {
                let res = match datatype {
                    Datatype::Uint8 => write!(f, "{}{}", sep, self.get::<u8>(c)),
                    Datatype::Uint16 => write!(f, "{}{}", sep, self.get::<u16>(c)),
                    Datatype::Uint32 => write!(f, "{}{}", sep, self.get::<u32>(c)),
                    Datatype::Float32 => write!(f, "{}{}", sep, self.get::<f32>(c)),
                    Datatype::Int8 => write!(f, "{}{}", sep, self.get::<i8>(c)),
                    Datatype::Int16 => write!(f, "{}{}", sep, self.get::<i16>(c)),
                    Datatype::Int32 => write!(f, "{}{}", sep, self.get::<i32>(c)),
                    Datatype::Bool => write!(f, "{}{}", sep, self.get::<u8>(c)),
                };
                sep = ", ";
                res
            })
            .collect::<Result<Vec<_>, _>>()?;
        write!(f, ")")
    }
}

impl PixelValue {
    pub(crate) fn new(num_channels: Channels, datatype: Datatype) -> Self {
        Self {
            num_channels,
            datatype,
            bytes: [0_u8; 32],
        }
    }

    pub(crate) fn from_image(image: &LocalImageData, pixel: &UVec2) -> Self {
        let c = image.info.channels;
        let pixel_index = (pixel.x + pixel.y * image.info.width) as usize;
        let bytes_per_element = image.info.datatype.num_bytes();
        let start = pixel_index * c as usize * bytes_per_element;
        let end = start + c as usize * bytes_per_element;
        let bytes = &image.bytes[start..end];
        let mut bytes_array = [0_u8; 32];
        bytes_array[..bytes.len()].copy_from_slice(bytes);
        Self {
            num_channels: c,
            datatype: image.info.datatype,
            bytes: bytes_array,
        }
    }

    pub(crate) fn get<T: Pod>(&self, channel: u32) -> &T {
        debug_assert!(channel < self.num_channels as u32);
        let bytes_per_element = self.datatype.num_bytes();
        let start = channel as usize * bytes_per_element;
        let end = start + bytes_per_element;
        let bytes = &self.bytes[start..end];
        bytemuck::from_bytes::<T>(bytes)
    }

    pub(crate) fn get_mut<T: Pod>(&mut self, channel: u32) -> &mut T {
        debug_assert!(channel < self.num_channels as u32);
        let bytes_per_element = self.datatype.num_bytes();
        let start = channel as usize * bytes_per_element;
        let end = start + bytes_per_element;
        let bytes = &mut self.bytes[start..end];
        bytemuck::from_bytes_mut::<T>(bytes)
    }

    pub(crate) fn fill<T: Pod>(&mut self, value: T) {
        for channel in 0..self.num_channels.into() {
            *self.get_mut::<T>(channel) = value;
        }
    }

    pub(crate) fn as_rgba_f32(&self) -> [f32; 4] {
        let mut res = [0_f32; 4];
        for channel in 0..self.num_channels.into() {
            res[channel as usize] = match self.datatype {
                Datatype::Uint8 => *self.get::<u8>(channel) as f32,
                Datatype::Uint16 => *self.get::<u16>(channel) as f32,
                Datatype::Uint32 => *self.get::<u32>(channel) as f32,
                Datatype::Float32 => *self.get::<f32>(channel),
                Datatype::Int8 => *self.get::<i8>(channel) as f32,
                Datatype::Int16 => *self.get::<i16>(channel) as f32,
                Datatype::Int32 => *self.get::<i32>(channel) as f32,
                Datatype::Bool => *self.get::<u8>(channel) as f32,
            }
        }
        res
    }
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) enum Coloring {
    Default,
    Grayscale,
    R,
    G,
    B,
    SwapRgbBgr,
    Segmentation { name: String },
    Heatmap { name: String },
}

#[derive(
    Builder, tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash,
)]
pub(crate) struct DrawingOptions {
    pub coloring: Coloring,
    pub invert: bool,
    pub high_contrast: bool,
    pub ignore_alpha: bool,
}

impl Default for DrawingOptions {
    fn default() -> Self {
        Self {
            coloring: Coloring::Default,
            invert: false,
            high_contrast: false,
            ignore_alpha: false,
        }
    }
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct ImageId(String);

#[cfg(debug_assertions)]
impl ImageId {
    pub(crate) fn new(id: &str) -> Self {
        Self(id.to_owned())
    }
}

impl Display for ImageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub(crate) enum ViewId {
    Primary,
}

pub(crate) fn all_views() -> Vec<ViewId> {
    vec![ViewId::Primary]
}

pub(crate) struct TextureImage {
    pub image: LocalImageData,
    pub texture: GLGuard<web_sys::WebGlTexture>,
}

impl TextureImage {
    pub(crate) fn try_new(
        image: crate::communication::incoming_messages::ImageData,
        gl: &web_sys::WebGl2RenderingContext,
    ) -> Result<Self, String> {
        let texture = webgl_utils::textures::create_texture_from_bytes(
            gl,
            &image.bytes,
            image.info.width,
            image.info.height,
            image.info.channels as _,
            image.info.datatype,
            webgl_utils::types::CreateTextureParametersBuilder::default()
                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                .wrap_s(webgl_utils::constants::TextureWrap::ClampToEdge)
                .wrap_t(webgl_utils::constants::TextureWrap::ClampToEdge)
                .build()
                .unwrap(),
        )?;
        let image = LocalImageData::from(image);
        Ok(Self { image, texture })
    }

    pub(crate) fn image_size(&self) -> Size {
        Size {
            width: self.image.info.width as f32,
            height: self.image.info.height as f32,
        }
    }
}

// // TODO: move from here

// #[rustfmt::skip]
// lazy_static! {
//     static ref FORMAT_AND_TYPE_FOR_DATATYPE_AND_CHANNELS: std::collections::HashMap<(Datatype, u32), (InternalFormat, Format, ElementType)> = {
//         let mut m = std::collections::HashMap::new();
//         // rustfmt
//         m.insert((Datatype::Uint8, 1), (InternalFormat::R8UI, Format::RedInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Uint8, 2), (InternalFormat::RG8UI, Format::RgInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Uint8, 3), (InternalFormat::RGB8UI, Format::RgbInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Uint8, 4), (InternalFormat::RGBA8UI, Format::RgbaInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Int8, 1), (InternalFormat::R8I, Format::RedInteger, ElementType::Byte));
//         m.insert((Datatype::Int8, 2), (InternalFormat::RG8I, Format::RgInteger, ElementType::Byte));
//         m.insert((Datatype::Int8, 3), (InternalFormat::RGB8I, Format::RgbInteger, ElementType::Byte));
//         m.insert((Datatype::Int8, 4), (InternalFormat::RGBA8I, Format::RgbaInteger, ElementType::Byte));
//         m.insert((Datatype::Uint16, 1), (InternalFormat::R16UI, Format::RedInteger, ElementType::UnsignedShort));
//         m.insert((Datatype::Uint16, 2), (InternalFormat::RG16UI, Format::RgInteger, ElementType::UnsignedShort));
//         m.insert((Datatype::Uint16, 3), (InternalFormat::RGB16UI, Format::RgbInteger, ElementType::UnsignedShort));
//         m.insert((Datatype::Uint16, 4), (InternalFormat::RGBA16UI, Format::RgbaInteger, ElementType::UnsignedShort));
//         m.insert((Datatype::Int16, 1), (InternalFormat::R16I, Format::RedInteger, ElementType::Short));
//         m.insert((Datatype::Int16, 2), (InternalFormat::RG16I, Format::RgInteger, ElementType::Short));
//         m.insert((Datatype::Int16, 3), (InternalFormat::RGB16I, Format::RgbInteger, ElementType::Short));
//         m.insert((Datatype::Int16, 4), (InternalFormat::RGBA16I, Format::RgbaInteger, ElementType::Short));
//         m.insert((Datatype::Uint32, 1), (InternalFormat::R32UI, Format::RedInteger, ElementType::UnsignedInt));
//         m.insert((Datatype::Uint32, 2), (InternalFormat::RG32UI, Format::RgInteger, ElementType::UnsignedInt));
//         m.insert((Datatype::Uint32, 3), (InternalFormat::RGB32UI, Format::RgbInteger, ElementType::UnsignedInt));
//         m.insert((Datatype::Uint32, 4), (InternalFormat::RGBA32UI, Format::RgbaInteger, ElementType::UnsignedInt));
//         m.insert((Datatype::Int32, 1), (InternalFormat::R32I, Format::RedInteger, ElementType::Int));
//         m.insert((Datatype::Int32, 2), (InternalFormat::RG32I, Format::RgInteger, ElementType::Int));
//         m.insert((Datatype::Int32, 3), (InternalFormat::RGB32I, Format::RgbInteger, ElementType::Int));
//         m.insert((Datatype::Int32, 4), (InternalFormat::RGBA32I, Format::RgbaInteger, ElementType::Int));
//         m.insert((Datatype::Float32, 1), (InternalFormat::R32F, Format::Red, ElementType::Float));
//         m.insert((Datatype::Float32, 2), (InternalFormat::RG32F, Format::RG, ElementType::Float));
//         m.insert((Datatype::Float32, 3), (InternalFormat::RGB32F, Format::Rgb, ElementType::Float));
//         m.insert((Datatype::Float32, 4), (InternalFormat::RGBA32F, Format::Rgba, ElementType::Float));
//         m.insert((Datatype::Bool, 1), (InternalFormat::R8UI, Format::RedInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Bool, 2), (InternalFormat::RG8UI, Format::RgInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Bool, 3), (InternalFormat::RGB8UI, Format::RgbInteger, ElementType::UnsignedByte));
//         m.insert((Datatype::Bool, 4), (InternalFormat::RGBA8UI, Format::RgbaInteger, ElementType::UnsignedByte));

//         m
//     };
// }

// fn create_texture_from_image_data(
//     gl: &web_sys::WebGl2RenderingContext,
//     image: &crate::communication::incoming_messages::ImageData,
//     parameters: webgl_utils::CreateTextureParameters,
// ) -> Result<GLGuard<web_sys::WebGlTexture>, String> {
//     let tex = webgl_utils::gl_guarded(gl.clone(), |gl| {
//         gl.create_texture().ok_or("Could not create texture")
//     })?;
//     let width = image.info.width;
//     let height = image.info.height;
//     gl.bind_texture(webgl_utils::TextureTarget::Texture2D as _, Some(&tex));
//     let (internal_format, format, type_) = *FORMAT_AND_TYPE_FOR_DATATYPE_AND_CHANNELS
//         .get(&(image.info.datatype, image.info.channels as _))
//         .ok_or_else(|| {
//             format!(
//                 "Could not find internal format for datatype {:?} and channels {}",
//                 image.info.datatype, image.info.channels,
//             )
//         })?;
//     gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_array_buffer_view_and_src_offset(
//         webgl_utils::TextureTarget::Texture2D as _,
//         0,
//         internal_format as _,
//         width as i32,
//         height as i32,
//         0,
//         format as _,
//         type_ as _,
//         &webgl_utils::utils::js_typed_array_from_bytes(&image.bytes, type_)?,
//         0,
//     )
//     .map_err(|jsvalue| format!("Could not create texture from image: {:?}", jsvalue))?;

//     if let Some(mag_filter) = parameters.mag_filter {
//         gl.tex_parameteri(
//             webgl_utils::TextureTarget::Texture2D as _,
//             web_sys::WebGl2RenderingContext::TEXTURE_MAG_FILTER,
//             mag_filter as i32,
//         );
//     }
//     if let Some(min_filter) = parameters.min_filter {
//         gl.tex_parameteri(
//             webgl_utils::TextureTarget::Texture2D as _,
//             web_sys::WebGl2RenderingContext::TEXTURE_MIN_FILTER,
//             min_filter as i32,
//         );
//     }
//     if let Some(wrap_s) = parameters.wrap_s {
//         gl.tex_parameteri(
//             webgl_utils::TextureTarget::Texture2D as _,
//             web_sys::WebGl2RenderingContext::TEXTURE_WRAP_S,
//             wrap_s as i32,
//         );
//     }
//     if let Some(wrap_t) = parameters.wrap_t {
//         gl.tex_parameteri(
//             webgl_utils::TextureTarget::Texture2D as _,
//             web_sys::WebGl2RenderingContext::TEXTURE_WRAP_T,
//             wrap_t as i32,
//         );
//     }

//     Ok(tex)
// }
