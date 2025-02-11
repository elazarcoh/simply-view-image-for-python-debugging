use gloo::events::{EventListener, EventListenerOptions};
use gloo_utils::window;
use std::borrow::Cow;
use wasm_bindgen::JsValue;
use yew::prelude::*;
use yew_hooks::use_latest;

#[hook]
pub fn use_event<T, F, E>(node: NodeRef, event_type: T, callback: F)
where
    T: Into<Cow<'static, str>>,
    F: Fn(E) + 'static,
    E: From<JsValue>,
{
    let callback = use_latest(callback);

    use_effect_with((node, event_type.into()), move |(node, event_type)| {
        let node = node.get();
        let target = node.as_deref();

        let listener = {
            target.map(|target| {
                EventListener::new_with_options(
                    target,
                    event_type.clone(),
                    EventListenerOptions::enable_prevent_default(),
                    move |event| {
                        (*callback.current())(JsValue::from(event).into());
                    },
                )
            })
        };

        move || drop(listener)
    });
}

#[hook]
pub fn use_window_event<T, F, E>(event_type: T, callback: F)
where
    T: Into<Cow<'static, str>>,
    F: Fn(E) + 'static,
    E: From<JsValue>,
{
    let callback = use_latest(callback);

    use_effect_with(event_type.into(), move |event_type| {
        let target = &*window();

        let listener = {
            EventListener::new_with_options(
                target,
                event_type.clone(),
                EventListenerOptions::enable_prevent_default(),
                move |event| {
                    (*callback.current())(JsValue::from(event).into());
                },
            )
        };

        move || drop(listener)
    });
}
