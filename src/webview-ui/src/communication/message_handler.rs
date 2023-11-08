use gloo::events::EventListener;
use gloo_utils::format::JsValueSerdeExt;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use yew::prelude::*;

use crate::communication::incoming_messages::FromExtensionMessageWithId;

use super::incoming_messages::FromExtensionMessage;

pub trait IncomeMessageHandler {
    fn handle_incoming_message(&self, message: FromExtensionMessage);
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
        let message: FromExtensionMessageWithId = data.into_serde().unwrap();

        incoming_message_handler.handle_incoming_message(message.message);
    });

    let window = web_sys::window().unwrap();
    EventListener::new(&window, "message", move |e| onmessage.emit(e.clone()))
}
