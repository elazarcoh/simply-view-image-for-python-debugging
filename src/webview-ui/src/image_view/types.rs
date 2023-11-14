use anyhow::{anyhow, Result};
use std::fmt::Display;

use bytemuck::Pod;
use glam::UVec2;
use strum::EnumCount;

use crate::{
    common::{Channels, Datatype, ImageData, Size},
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

    pub(crate) fn from_image(image: &ImageData, pixel: &UVec2) -> Self {
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
    pub image: ImageData,
    pub texture: GLGuard<web_sys::WebGlTexture>,
}

impl TextureImage {
    pub(crate) fn try_new(image: ImageData, gl: &web_sys::WebGl2RenderingContext) -> Result<Self> {
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
        let image = ImageData::from(image);
        Ok(Self { image, texture })
    }

    pub(crate) fn image_size(&self) -> Size {
        Size {
            width: self.image.info.width as f32,
            height: self.image.info.height as f32,
        }
    }
}
