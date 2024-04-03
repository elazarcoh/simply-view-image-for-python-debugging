use anyhow::Result;
use std::{
    convert::{TryFrom, TryInto},
    fmt::Display,
};

use bytemuck::Pod;
use glam::UVec2;
use strum::EnumCount;

use crate::common::{Channels, Datatype, ImageData};

use super::DataOrdering;

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

        let bytes_array = match image.info.data_ordering {
            DataOrdering::HWC => {
                let start = pixel_index * c as usize * bytes_per_element;
                let end = start + c as usize * bytes_per_element;
                let bytes = &image.bytes[start..end];
                let mut bytes_array = [0_u8; 32];
                bytes_array[..bytes.len()].copy_from_slice(bytes);
                bytes_array
            }
            DataOrdering::CHW => {
                let plane_size =
                    (image.info.width * image.info.height) as usize * bytes_per_element;
                let mut bytes_array = [0_u8; 32];
                for channel in 0..c as usize {
                    let start = plane_size * channel + pixel_index * bytes_per_element;
                    let end = start + bytes_per_element;
                    let bytes = &image.bytes[start..end];
                    bytes_array[channel * bytes_per_element..(channel + 1) * bytes_per_element]
                        .copy_from_slice(bytes);
                }
                bytes_array
            }
        };

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



macro_rules! impl_try_from_single {
    ($t:ty, $dt:ident) => {
        impl TryFrom<$t> for PixelValue {
            type Error = anyhow::Error;

            fn try_from(value: $t) -> Result<Self, Self::Error> {
                let mut res = Self::new(Channels::One, Datatype::$dt);
                *res.get_mut::<$t>(0) = value;
                Ok(res)
            }
        }
    };
}
macro_rules! impl_try_from_vec {
    ($t:ty, $dt:ident) => {
        impl TryFrom<Vec<$t>> for PixelValue {
            type Error = anyhow::Error;

            fn try_from(value: Vec<$t>) -> Result<Self, Self::Error> {
                let channels: Channels = (value.len() as u32).try_into()?;
                let mut res = Self::new(channels, Datatype::$dt);
                for (i, v) in value.iter().enumerate() {
                    *res.get_mut::<$t>(i as u32) = *v;
                }
                Ok(res)
            }
        }
    };
}

impl_try_from_single!(u8, Uint8);
impl_try_from_single!(u16, Uint16);
impl_try_from_single!(u32, Uint32);
impl_try_from_single!(f32, Float32);
impl_try_from_single!(i8, Int8);
impl_try_from_single!(i16, Int16);
impl_try_from_single!(i32, Int32);
// impl_try_from_single!(bool, Bool);
impl_try_from_vec!(u8, Uint8);
impl_try_from_vec!(u16, Uint16);
impl_try_from_vec!(u32, Uint32);
impl_try_from_vec!(f32, Float32);
impl_try_from_vec!(i8, Int8);
impl_try_from_vec!(i16, Int16);
impl_try_from_vec!(i32, Int32);
// impl_try_from_vec!(bool, Bool);