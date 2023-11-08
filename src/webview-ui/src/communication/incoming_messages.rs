// use wasm_bindgen::prelude::*;

// #[wasm_bindgen]
// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(namespace)]
// pub enum Action {
//     Image = "image",
// }

// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
// pub enum Datatype {
//     U8,
//     U8C3,
//     U8C4,
//     F32,
//     F32C3,
//     F32C4,
// }

// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
// pub struct ImageMessage {
//     pub action: Action,
//     pub identifier: Identifier,
//     pub width: u32,
//     pub height: u32,
//     pub channels: u32,
//     pub datatype: Datatype,
//     pub data: Base64,
// }

// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
// pub struct Viewable {
//     pub identifier: Identifier,
//     pub name: String,
//     pub width: u32,
//     pub height: u32,
//     pub channels: u32,
//     pub datatype: Datatype,
// }

// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
// pub struct RequestViewable {
//     pub identifier: Identifier,
// }

// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
// pub enum PostWebviewMessage {
//     Image(ImageMessage),
//     Viewable(Viewable),
// }

// #[derive(Tsify, Serialize, Deserialize)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
// pub enum PostVSCodeMessage {
//     RequestViewable(RequestViewable),
// }

use super::common::MessageId;

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug)]
pub struct ImageInfo {
    pub name: String,
    // pub shape: Option<Vec<u32>>,
    // pub data_type: Option<String>,
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug)]
pub struct ImageObjects {
    pub variables: Vec<ImageInfo>,
    pub expressions: Vec<ImageInfo>,
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug)]
pub struct ShowImage {
    pub image_base64: String,
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum FromExtensionMessage {
    ShowImageMessage(ShowImage),
    ImageObjects(ImageObjects),
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
pub struct FromExtensionMessageWithId {
    pub(crate) id: MessageId,
    pub(crate) message: FromExtensionMessage,
}
