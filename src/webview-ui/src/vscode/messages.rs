use std::collections::HashMap;

use crate::common::{Channels, Datatype, ImageId, ValueVariableKind};

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone)]
pub(crate) struct MessageId(String);

impl MessageId {
    pub(crate) fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        Self(uuid.to_string())
    }
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ImageMessage {
    pub image_id: ImageId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
    pub width: u32,
    pub height: u32,
    #[tsify(type = "1 | 2 | 3 | 4")]
    pub channels: Channels,
    pub datatype: Datatype,
    pub additional_info: HashMap<String, String>,

    #[tsify(type = "ArrayBuffer | null")]
    #[serde(with = "serde_bytes")]
    pub bytes: Option<Vec<u8>>,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ImageObjects(pub Vec<ImageMessage>);

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ReplaceData {
    pub replacement_images: ImageObjects,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum ExtensionResponse {
    ImageData(ImageMessage),
    ReplaceData(ReplaceData),
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ShowImageOptions {}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum ExtensionRequest {
    ShowImage {
        image_data: ImageMessage,
        options: ShowImageOptions,
    },
    ReplaceData(ReplaceData),
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
#[serde(tag = "kind")]
pub(crate) enum FromExtensionMessage {
    Response(ExtensionResponse),
    Request(ExtensionRequest),
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct FromExtensionMessageWithId {
    pub(crate) id: MessageId,
    pub(crate) message: FromExtensionMessage,
}
