use gloo::events::EventListener;
use gloo_utils::format::JsValueSerdeExt;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use yew::Callback;

use super::{
    incoming_messages::{IncomingMessage, SetImageMessage},
    outgoing_messages::OutgoingMessage,
};

pub trait IncomeMessageHandler {
    fn handle_incoming_message(&self, message: IncomingMessage);
}
pub trait OutgoingMessageSender {
    fn send_message(&self, message: OutgoingMessage);
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct MyMessage {
    pub message: String,
    #[serde(rename = "imageBase64")]
    pub image_base64: String,
}

fn parse_message(message: MyMessage) -> IncomingMessage {
    IncomingMessage::SetImageMessage(SetImageMessage {
        image_base64: message.image_base64,
    })
}

pub fn install_incoming_message_handler(
    incoming_message_handler: Rc<dyn IncomeMessageHandler>,
) -> EventListener {
    let onmessage = Callback::from(move |event: web_sys::Event| {
        let data = event
            .dyn_ref::<web_sys::MessageEvent>()
            .expect("Unable to cast event to MessageEvent")
            .data();

        log::debug!("Received message: {:?}", data);
        let message: MyMessage = data.into_serde().unwrap();
        log::debug!("Received message.message: {:?}", message.message);

        let message = parse_message(message);

        incoming_message_handler.handle_incoming_message(message);
    });

    let window = web_sys::window().unwrap();
    EventListener::new(&window, "message", move |e| onmessage.emit(e.clone()))
}
