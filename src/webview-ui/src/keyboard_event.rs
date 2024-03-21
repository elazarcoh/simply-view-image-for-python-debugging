use gloo::events::{EventListener, EventListenerOptions};
use gloo_utils::window;
use wasm_bindgen::JsCast;
use web_sys::Event;
use yew::Callback;

pub(crate) struct KeyboardHandler {}

impl KeyboardHandler {
    pub(crate) fn install(node_ref: &yew::NodeRef) -> Option<EventListener> {
        let keydown = {
            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::KeyboardEvent>()
                    .expect("Unable to cast event to KeyboardEvent");
                let key = event.key();
                log::info!("Keydown: {}", key);
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
