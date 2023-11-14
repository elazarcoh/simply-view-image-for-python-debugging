use std::{convert::TryFrom, fmt::Display};

use crate::image_view::{
    types::{ImageId, PixelValue},
    utils::image_minmax_on_bytes,
};

#[derive(Debug)]
pub(crate) struct Size {
    pub width: f32,
    pub height: f32,
}

impl Size {
    pub(crate) fn from_width_and_height_u32((width, height): (u32, u32)) -> Self {
        Self {
            width: width as _,
            height: height as _,
        }
    }
}

#[derive(tsify::Tsify, serde::Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValueVariableKind {
    #[serde(rename = "variable")]
    Variable,
    #[serde(rename = "expression")]
    Expression,
}

#[derive(
    serde_repr::Deserialize_repr,
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    strum_macros::EnumCount,
)]
#[repr(u32)]
pub(crate) enum Channels {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
}
impl From<Channels> for u32 {
    fn from(c: Channels) -> Self {
        c as u32
    }
}
impl TryFrom<u32> for Channels {
    type Error = &'static str;
    fn try_from(v: u32) -> Result<Self, Self::Error> {
        match v {
            1 => Ok(Channels::One),
            2 => Ok(Channels::Two),
            3 => Ok(Channels::Three),
            4 => Ok(Channels::Four),
            _ => Err("Invalid value for Channels"),
        }
    }
}
impl Display for Channels {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Channels::One => "1",
            Channels::Two => "2",
            Channels::Three => "3",
            Channels::Four => "4",
        };
        f.write_str(s)
    }
}

#[derive(tsify::Tsify, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash, Copy)]
pub(crate) enum Datatype {
    #[serde(rename = "uint8")]
    Uint8,
    #[serde(rename = "uint16")]
    Uint16,
    #[serde(rename = "uint32")]
    Uint32,
    // #[serde(rename = "float16")]  // not supported by rust (not IEEE)
    // Float16,
    #[serde(rename = "float32")]
    Float32,
    // #[serde(rename = "float64")]  // not supported by webgl
    // Float64,
    #[serde(rename = "int8")]
    Int8,
    #[serde(rename = "int16")]
    Int16,
    #[serde(rename = "int32")]
    Int32,
    // #[serde(rename = "int64")]  // not supported by webgl
    // Int64,
    // #[serde(rename = "uint64")]  // not supported by webgl
    // Uint64,
    #[serde(rename = "bool")]
    Bool,
}

impl Datatype {
    pub(crate) fn num_bytes(&self) -> usize {
        match self {
            Datatype::Uint8 => 1,
            Datatype::Uint16 => 2,
            Datatype::Uint32 => 4,
            // Datatype::Float16 => 2,
            Datatype::Float32 => 4,
            // Datatype::Float64 => 8,
            Datatype::Int8 => 1,
            Datatype::Int16 => 2,
            Datatype::Int32 => 4,
            // Datatype::Int64 => 8,
            // Datatype::Uint64 => 8,
            Datatype::Bool => 1,
        }
    }

    // pub(crate) fn is_floating(&self) -> bool {
    //     matches!(
    //         self,
    //         Datatype::Float32,
    //         // Datatype::Float64
    //     )
    // }

    // pub(crate) fn is_unsigned_integer(&self) -> bool {
    //     matches!(self, Datatype::Uint8 | Datatype::Uint16 | Datatype::Uint32)
    // }

    // pub(crate) fn is_signed_integer(&self) -> bool {
    //     matches!(self, Datatype::Int8 | Datatype::Int16 | Datatype::Int32)
    // }
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ImageInfo {
    pub image_id: ImageId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
    pub width: u32,
    pub height: u32,
    pub channels: Channels,
    pub datatype: Datatype,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ComputedInfo {
    pub min: PixelValue,
    pub max: PixelValue,
}

pub(crate) struct ImageData {
    pub info: ImageInfo,
    pub computed_info: ComputedInfo,
    pub bytes: Vec<u8>,
}
