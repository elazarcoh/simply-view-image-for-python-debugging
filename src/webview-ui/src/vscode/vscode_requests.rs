use std::rc::Rc;

use tsify::JsValueSerdeExt;
use wasm_bindgen::JsValue;

use yewdux::prelude::*;

use crate::common::ViewableObjectId;
use crate::vscode::WebviewApi;

use super::messages::MessageId;

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct WebviewReady {}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct RequestImageData {
    image_id: ViewableObjectId,
    expression: String,
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct RequestBatchItemData {
    image_id: ViewableObjectId,
    expression: String,
    batch_item: u32,
    currently_holding: Option<Vec<u32>>,
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct RequestImages {}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct AddExpression {}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct EditExpression {
    expression: String,
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
#[tsify(into_wasm_abi, from_wasm_abi)]
enum FromWebviewMessage {
    WebviewReady(WebviewReady),
    RequestImageData(RequestImageData),
    RequestBatchItemData(RequestBatchItemData),
    RequestImages(RequestImages),
    AddExpression(AddExpression),
    EditExpression(EditExpression),
}

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize)]
struct FromWebviewMessageWithId {
    id: MessageId,
    message: FromWebviewMessage,
}

#[derive(Store, Clone, PartialEq, Default)]
struct WebviewApiStore {
    vscode: Option<Rc<WebviewApi>>,
}

pub(crate) struct VSCodeRequests;

impl VSCodeRequests {
    fn vscode() -> Rc<WebviewApi> {
        Dispatch::<WebviewApiStore>::global().get().vscode.as_ref().ok_or(
            "VSCodeRequests::vscode: VSCodeRequests::init must be called before VSCodeRequests::vscode",
        ).unwrap().clone()
    }

    pub(crate) fn init(vscode: WebviewApi) {
        Dispatch::<WebviewApiStore>::global().reduce_mut(move |state| {
            state.vscode = Some(Rc::new(vscode));
        });
    }

    fn send_message(message: FromWebviewMessage) -> MessageId {
        let id = MessageId::generate();
        Self::vscode().post_message(
            JsValue::from_serde(&FromWebviewMessageWithId {
                id: id.clone(),
                message,
            })
            .unwrap(),
        );
        id
    }
}

impl VSCodeRequests {
    pub(crate) fn request_images() -> MessageId {
        log::debug!("VSCodeRequests::requests_images");
        Self::send_message(FromWebviewMessage::RequestImages(RequestImages {}))
    }

    pub(crate) fn request_image_data(image_id: ViewableObjectId, expression: String) -> MessageId {
        log::debug!("VSCodeRequests::request_image_data: {:?}", image_id);
        Self::send_message(FromWebviewMessage::RequestImageData(RequestImageData {
            image_id,
            expression,
        }))
    }

    pub(crate) fn request_batch_item_data(
        image_id: ViewableObjectId,
        expression: String,
        batch_item: u32,
        currently_holding: Option<Vec<u32>>,
    ) -> MessageId {
        log::debug!("VSCodeRequests::request_batch_item_data: {:?}", image_id);
        Self::send_message(FromWebviewMessage::RequestBatchItemData(
            RequestBatchItemData {
                image_id,
                expression,
                batch_item,
                currently_holding,
            },
        ))
    }

    pub(crate) fn webview_ready() -> MessageId {
        log::debug!("VSCodeRequests::webview_ready");
        Self::send_message(FromWebviewMessage::WebviewReady(WebviewReady {}))
    }

    pub(crate) fn add_expression() -> MessageId {
        log::debug!("VSCodeRequests::add_expression");
        Self::send_message(FromWebviewMessage::AddExpression(AddExpression {}))
    }

    pub(crate) fn edit_expression(expression: String) -> MessageId {
        log::debug!("VSCodeRequests::edit_expression: {:?}", expression);
        Self::send_message(FromWebviewMessage::EditExpression(EditExpression {
            expression,
        }))
    }
}
