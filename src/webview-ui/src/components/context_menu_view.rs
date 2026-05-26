use gloo::events::EventListener;
use wasm_bindgen::JsCast;
use yew::prelude::*;

use crate::components::context_menu::{use_context_menu, ContextMenuData};

#[function_component(ContextMenu)]
pub fn context_menu() -> Html {
    let ctx = use_context_menu();
    let menu_ref = use_node_ref();

    {
        let ctx = ctx.clone();
        let menu_ref = menu_ref.clone();

        use_effect_with((), move |_| {
            let document = web_sys::window().unwrap().document().unwrap();

            // Hide on left click
            let click_listener = EventListener::new(&document, "click", {
                let ctx = ctx.clone();
                let menu_ref = menu_ref.clone();
                move |e| {
                    let target = e.target().and_then(|t| t.dyn_into::<web_sys::Node>().ok());
                    let inside = match (target, menu_ref.cast::<web_sys::Node>()) {
                        (Some(t), Some(m)) => m.contains(Some(&t)),
                        _ => false,
                    };
                    if !inside {
                        ctx.set(None);
                    }
                }
            });

            // Hide on Escape key
            let key_listener = EventListener::new(&web_sys::window().unwrap(), "keydown", {
                let ctx = ctx.clone();
                move |e| {
                    let event = e.dyn_ref::<KeyboardEvent>();
                    if let Some(k) = event {
                        if k.key() == "Escape" {
                            ctx.set(None);
                        }
                    }
                }
            });

            move || {
                drop(click_listener);
                drop(key_listener);
            }
        });
    }

    if let Some(ContextMenuData { x, y, items }) = &*ctx {
        html! {
            <ul
                ref={menu_ref}
                class="context-menu"
                style={format!("top: {}px; left: {}px;", y, x)}
            >
                { for items.iter().map(|item| {
                    let action = item.action.clone();
                    let disabled = item.disabled;
                    html! {
                        <li
                            class={classes!("context-menu-item", if disabled { "disabled" } else { "" })}
                            onclick={if !disabled { Callback::from(move |_| action.emit(())) } else { Callback::noop() }}
                        >
                            { &item.label }
                        </li>
                    }
                })}
            </ul>
        }
    } else {
        html! {}
    }
}
