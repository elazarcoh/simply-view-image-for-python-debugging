use std::{collections::HashMap, convert::TryFrom, fmt::Display};

use crate::image_view::types::ImageId;

use super::common::MessageId;

#[derive(tsify::Tsify, serde::Deserialize, Debug, Clone, PartialEq)]
pub enum ValueVariableKind {
    #[serde(rename = "variable")]
    Variable,
    #[serde(rename = "expression")]
    Expression,
}

#[derive(serde_repr::Deserialize_repr, Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[repr(u32)]
pub enum Channels {
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
pub enum Datatype {
    #[serde(rename = "uint8")]
    Uint8,
    #[serde(rename = "uint16")]
    Uint16,
    // #[serde(rename = "uint32")]
    // Uint32,
    #[serde(rename = "float32")]
    Float32,
    // #[serde(rename = "float64")]
    // Float64,
    #[serde(rename = "int8")]
    Int8,
    #[serde(rename = "int16")]
    Int16,
    // #[serde(rename = "int32")]
    // Int32,
    // #[serde(rename = "int64")]
    // Int64,
    // #[serde(rename = "uint64")]
    // Uint64,
    #[serde(rename = "bool")]
    Bool,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug, Clone, PartialEq)]
pub struct ImageInfo {
    pub image_id: ImageId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
    pub width: u32,
    pub height: u32,
    #[tsify(type = "1 | 2 | 3 | 4")]
    pub channels: Channels,
    pub datatype: Datatype,
    pub additional_info: HashMap<String, String>,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub struct ImageData {
    #[serde(flatten)]
    pub info: ImageInfo,

    #[tsify(type = "ArrayBuffer")]
    #[serde(with = "serde_bytes")]
    pub bytes: Vec<u8>,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub struct ImageObjects {
    pub variables: Vec<ImageInfo>,
    pub expressions: Vec<ImageInfo>,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
#[serde(tag = "type")]
pub enum FromExtensionMessage {
    ImageData(ImageData),
    ImageObjects(ImageObjects),
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub struct FromExtensionMessageWithId {
    pub(crate) id: MessageId,
    pub(crate) message: FromExtensionMessage,
}
