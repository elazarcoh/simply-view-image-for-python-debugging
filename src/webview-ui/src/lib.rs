#![deny(clippy::all)]

#[macro_use]
extern crate derive_builder;
#[macro_use]
extern crate lazy_static;
extern crate cfg_if;

mod app;
mod app_state;
mod common;
mod components;
mod configurations;
mod keyboard_event;
mod math_utils;
mod mouse_events;
mod vscode;
mod webgl_utils;

mod coloring;
mod colormap;
mod rendering;
#[cfg(debug_assertions)]
mod tmp_for_debug;

use core::{fmt, time};
use std::boxed;
use std::cell::RefCell;
use std::rc::Rc;

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

use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::*;
use web_sys::window;

pub fn debounce<T, F>(func: F, wait: u64, immediate: bool) -> Box<impl Fn(T)>
where
    F: FnMut(T) + 'static,
    T: fmt::Debug + JsCast + Clone,
    wasm_bindgen::JsValue: From<T>,
{
    let func = Rc::new(RefCell::new(Some(func)));
    let timeout = Rc::new(RefCell::<Option<i32>>::new(None));
    let previous = Rc::new(RefCell::<Option<f64>>::new(None));

    let later: Rc<RefCell<Option<Closure<dyn FnMut(JsValue)>>>> = Rc::new(RefCell::new(None));

    *later.borrow_mut() = Some(Closure::wrap(Box::new({
        let later = Rc::clone(&later);

        let func = Rc::clone(&func);
        let previous = Rc::clone(&previous);
        let timeout = Rc::clone(&timeout);

        move |arg| {
            log::debug!("calling later {:?}", arg);
            let now = js_sys::Date::now();
            if let Some(prev) = previous.borrow().as_ref() {
                let passed = now - prev;
                if wait as f64 > passed {
                    let timer = window()
                        .expect("should have a Window on the global object")
                        .set_timeout_with_callback_and_timeout_and_arguments_1(
                            later.borrow().as_ref().unwrap().as_ref().unchecked_ref(),
                            (wait as f64 - passed) as i32,
                            &arg,
                        )
                        .expect("should be able to set timeout");
                    *timeout.borrow_mut() = Some(timer);
                } else {
                    *timeout.borrow_mut() = None;
                    if !immediate {
                        if let Some(func) = func.borrow_mut().as_mut() {
                            let arg = arg.dyn_into::<T>().unwrap();
                            func(arg);
                        }
                    }
                }
            }
        }
    }) as Box<dyn FnMut(JsValue)>));

    let debounced = {
        move |arg: T| {
            log::debug!("checking debounced {:?}", arg);
            *previous.borrow_mut() = Some(js_sys::Date::now());
            if timeout.borrow().is_none() {
                log::debug!("debounced just now");
                let timer = window()
                    .expect("should have a Window on the global object")
                    .set_timeout_with_callback_and_timeout_and_arguments_1(
                        later.borrow().as_ref().unwrap().as_ref().unchecked_ref(),
                        wait as i32,
                        &JsValue::from(arg.clone()),
                    )
                    .expect("should be able to set timeout");

                *timeout.borrow_mut() = Some(timer);
                if immediate {
                    if let Some(func) = func.borrow_mut().as_mut() {
                        func(arg);
                    }
                }
            }
        }
    };

    Box::new(debounced)
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

    let data = Rc::new(RefCell::new(0));
    let test_debounce = debounce(
        {
            let data = Rc::clone(&data);
            move |x| {
                log::info!(
                    "!! debounced callback with {:?} and data is {:?}",
                    x,
                    data.borrow()
                );
                *data.borrow_mut() += 1;
            }
        },
        500,
        false,
    );

    test_debounce(JsValue::from(42));
    test_debounce(JsValue::from(43));
    
    // yew::Renderer::<App>::new().render();

    Ok(())
}
