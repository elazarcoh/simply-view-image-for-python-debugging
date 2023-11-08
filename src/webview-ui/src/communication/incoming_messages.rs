


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

pub struct SetImageMessage {
    pub image_base64: String,
}

pub enum IncomingMessage {
    SetImageMessage(SetImageMessage),
}
