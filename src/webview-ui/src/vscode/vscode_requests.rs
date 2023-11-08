use tsify::JsValueSerdeExt;
use wasm_bindgen::JsValue;

use crate::communication::common::MessageId;
use crate::{communication::server_requests::ServerRequests, vscode::WebviewApi};

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct RequestImageData {}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct RequestImages {}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
#[tsify(into_wasm_abi, from_wasm_abi)]
enum FromWebviewMessage {
    RequestImageData(RequestImageData),
    RequestImages(RequestImages),
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct FromWebviewMessageWithId {
    id: MessageId,
    message: FromWebviewMessage,
}

pub struct VSCodeRequests {
    vscode: WebviewApi,
}

impl VSCodeRequests {
    pub(crate) fn new(vscode: WebviewApi) -> Self {
        Self { vscode }
    }

    fn send_message(&self, message: FromWebviewMessage) -> MessageId {
        let id = MessageId::generate();
        self.vscode
            .post_message(JsValue::from_serde(&FromWebviewMessageWithId { id: id.clone(), message }).unwrap());
        id
    }
}

impl ServerRequests for VSCodeRequests {
    fn requests_images(&self) -> MessageId {
        log::debug!("VSCodeRequests::requests_images");
        self.send_message(FromWebviewMessage::RequestImages(RequestImages {}))
    }
}
