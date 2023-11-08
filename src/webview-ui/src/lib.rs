#![deny(clippy::all)]

#[macro_use]
extern crate derive_builder;
#[macro_use]
extern crate lazy_static;
#[macro_use]
extern crate cfg_if;

mod app;
mod common;
mod communication;
mod components;
mod configurations;
mod image_view;
mod math_utils;
mod mouse_events;
mod vscode;
mod webgl_utils;
mod store;
mod reducer;

#[cfg(debug_assertions)]
mod tmp_for_debug;

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

#[wasm_bindgen(start)]
fn run() -> Result<(), JsValue> {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    init_log();

    #[cfg(debug_assertions)]
    web_sys::console::clear();

    let _ = global_style!(r#"
        body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
    "#);

    yew::Renderer::<App>::new().render();

    Ok(())
}
