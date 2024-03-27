use gloo::events::{EventListener, EventListenerOptions};
use gloo_utils::window;
use wasm_bindgen::JsCast;
use web_sys::Event;
use yew::Callback;
use yewdux::Dispatch;

use crate::{
    app_state::app_state::{AppState, ChangeImageAction},
    common::ViewId,
};

pub(crate) struct KeyboardHandler {}

impl KeyboardHandler {
    fn handle_key(event: &web_sys::KeyboardEvent) {
        let key = event.key();
        let dispatch = Dispatch::<AppState>::global();
        match key.as_str() {
            "ArrowDown" => {
                event.prevent_default();
                dispatch.apply(ChangeImageAction::Next(ViewId::Primary));
            }
            "ArrowUp" => {
                event.prevent_default();
                dispatch.apply(ChangeImageAction::Previous(ViewId::Primary));
            }
            &_ => {}
        }
    }
    pub(crate) fn install(node_ref: &yew::NodeRef) -> Option<EventListener> {
        let keydown = {
            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::KeyboardEvent>()
                    .expect("Unable to cast event to KeyboardEvent");
                KeyboardHandler::handle_key(&event);
            })
        };

        let document = window().document().expect("document not found");
        let options = EventListenerOptions::enable_prevent_default();
        Some(EventListener::new_with_options(
            &document,
            "keydown",
            options,
            move |e| keydown.emit(e.clone()),
        ))
    }
}
