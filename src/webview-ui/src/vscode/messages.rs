use std::collections::HashMap;

use crate::common::{Channels, DataOrdering, Datatype, ValueVariableKind, ViewableObjectId};

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone)]
pub(crate) struct MessageId(String);

impl MessageId {
    pub(crate) fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        Self(uuid.to_string())
    }
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ImagePlaceholderMessage {
    pub image_id: ViewableObjectId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
    pub is_batched: bool,
    pub additional_info: HashMap<String, String>,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ImageMessage {
    pub image_id: ViewableObjectId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
    pub width: u32,
    pub height: u32,
    #[tsify(type = "1 | 2 | 3 | 4")]
    pub channels: Channels,
    pub datatype: Datatype,
    pub data_ordering: DataOrdering,
    pub is_batched: bool,
    pub batch_size: Option<u32>,
    pub batch_items_range: Option<(u32, u32)>,
    pub min: Option<Vec<f32>>,
    pub max: Option<Vec<f32>>,
    pub additional_info: HashMap<String, String>,

    #[tsify(type = "ArrayBuffer | null")]
    #[serde(with = "serde_bytes")]
    pub bytes: Vec<u8>,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ImagePlaceholders(pub Vec<ImagePlaceholderMessage>);

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct ReplaceData {
    pub replacement_images: ImagePlaceholders,
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
pub(crate) struct Configuration {
    pub invert_scroll_direction: Option<bool>,
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
    Configuration(Configuration),
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
#[serde(tag = "kind")]
pub(crate) enum FromExtensionMessage {
    Response(ExtensionResponse),
    Request(ExtensionRequest),
}

#[derive(tsify::Tsify, serde::Deserialize, Debug)]
#[allow(dead_code)]
pub(crate) struct FromExtensionMessageWithId {
    pub(crate) id: MessageId,
    pub(crate) message: FromExtensionMessage,
}
