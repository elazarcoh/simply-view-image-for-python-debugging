use gloo::events::{EventListener, EventListenerOptions};
use gloo_utils::window;
use wasm_bindgen::{prelude::Closure, JsCast, JsValue};
use web_sys::Event;
use yew::Callback;
use yewdux::Dispatch;

use crate::{
    application_state::app_state::{AppState, UiAction},
    bindings::lodash::debounce_closure,
    common::{constants, ViewId},
};

struct KeyboardEvent<'a> {
    key: &'a str,
    shift: bool,
    ctrl: bool,
    alt: bool,
}

pub(crate) struct KeyboardHandler {}

impl KeyboardHandler {
    fn handle_key(event: &web_sys::KeyboardEvent) {
        let key = event.key();

        let shift = event.shift_key();
        let ctrl = event.ctrl_key();
        let alt = event.alt_key();

        let keyboard_event = KeyboardEvent {
            key: key.as_str(),
            shift,
            ctrl,
            alt,
        };

        let dispatch = Dispatch::<AppState>::global();
        let cv = dispatch
            .get()
            .image_views
            .borrow()
            .get_currently_viewing(ViewId::Primary);

        match keyboard_event {
            // arrow up/down => change image
            KeyboardEvent {
                key: "ArrowDown",
                shift: false,
                ctrl: false,
                alt: false,
            } => {
                event.prevent_default();
                dispatch.apply(UiAction::Next(ViewId::Primary));
            }
            KeyboardEvent {
                key: "ArrowUp",
                shift: false,
                ctrl: false,
                alt: false,
            } => {
                event.prevent_default();
                dispatch.apply(UiAction::Previous(ViewId::Primary));
            }

            // shift + arrow up/down => scroll batch
            KeyboardEvent {
                key: "ArrowDown",
                shift: true,
                ctrl: false,
                alt: false,
            } => {
                event.prevent_default();
                if let Some(cv) = cv {
                    dispatch.apply(UiAction::ViewShiftScroll(ViewId::Primary, cv, 1.0));
                }
            }
            KeyboardEvent {
                key: "ArrowUp",
                shift: true,
                ctrl: false,
                alt: false,
            } => {
                event.prevent_default();
                if let Some(cv) = cv {
                    dispatch.apply(UiAction::ViewShiftScroll(
                        ViewId::Primary,
                        cv,
                        -1.0,
                    ));
                }
            }
            _ => {}
        }
    }

    pub(crate) fn install(_node_ref: &yew::NodeRef) -> Option<EventListener> {
        let key_handler = debounce_closure(
            Closure::wrap(Box::new(move |event: web_sys::KeyboardEvent| {
                KeyboardHandler::handle_key(&event);
            })),
            constants::TIMES.keyboard_debounce,
            Default::default(),
        );

        let keydown = {
            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::KeyboardEvent>()
                    .expect("Unable to cast event to KeyboardEvent");
                key_handler.call1(&JsValue::NULL, event).unwrap();
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
