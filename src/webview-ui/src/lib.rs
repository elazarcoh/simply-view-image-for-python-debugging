#![deny(clippy::all)]

#[macro_use]
extern crate derive_builder;
#[macro_use]
extern crate lazy_static;
extern crate cfg_if;

mod app;
mod application_state;
mod bindings;
mod coloring;
mod colormap;
mod common;
mod components;
mod configurations;
mod hooks;
mod keyboard_event;
mod math_utils;
mod mouse_events;
mod rendering;
#[cfg(debug_assertions)]
mod tmp_for_debug;
mod vscode;
mod webgl_utils;

use app::App;
use cfg_if::cfg_if;
use stylist::global_style;
use wasm_bindgen::prelude::*;

// If you don't want to use `wee_alloc`, you can safely delete this.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

cfg_if! {
    if #[cfg(feature = "console_log")] {
        fn init_log() {
            use log::Level;
            console_log::init_with_level(Level::Trace).expect("error initializing log");
        }
    } else {
        fn init_log() {}
    }
}

#[wasm_bindgen(start, skip_typescript)]
fn run() -> Result<(), JsValue> {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    init_log();

    #[cfg(debug_assertions)]
    web_sys::console::clear();

    let _ = global_style!(
        r#"
        body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
    "#
    );

    yew::Renderer::<App>::new().render();

    Ok(())
}
