use gloo::console;
use gloo_timers::callback::Interval;
use yew_hooks::use_raf;
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::{HtmlElement, WebGlRenderingContext};
use yew::prelude::*;

// use crate::components::glcontext::use_gl_context;
// use crate::components::GL;

#[derive(Properties, PartialEq)]
pub struct Props {}

#[function_component]
pub fn GLView(props: &Props) -> Html {
    // let glctx = use_gl_context();

    // let elapsedgc = use_raf(5000, 1000);
    let glctx = use_context::<crate::components::glcontext::MessageContext>();

    if glctx.is_none() {
        html! {
            <div>
                <p>{ "No GL context" }</p>
            </div>
        }
    } else {
        let cctx = glctx.unwrap();
        let message = cctx.inner.clone();
        let gl: Option<WebGlRenderingContext> = cctx.gl.clone();

        if let Some(gl) = gl {
            console::log!("GLView got gl context");
            gl.clear_color(1.0, 0.0, 0.0, 1.0);
            gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);
        } else {
            console::log!("GLView no gl context");
        }

        // let glctx: Rc<RefCell<GL>> = glctx.unwrap();
        // let gl = (*glctx).borrow().gl.clone();
        // console::log!("is_some: {}", gl.is_some());
        // gl.clear_color(1.0, 0.0, 0.0, 1.0);
        html! {
            <div>
                <p>{ "GL context" }</p>
                <p>{ message }</p>
            </div>
        }
    }
    // if glctx.is_none() {
    //     console::log!("GLView got no context");
    // } else {
    //     console::log!("GLView got gl context");

    //     let glctx = glctx.unwrap();
    //     if (*glctx).borrow().gl.is_some() {
    //         console::log!("GLView got gl ");
    //     } else {
    //         console::log!("GLView no gl ");
    //     }

    //     let timeout = Interval::new(1_000, move || {
    //         if (*glctx).borrow().gl.is_some() {
    //             console::log!("GLView got gl ");
    //         } else {
    //             console::log!("GLView no gl ");
    //         }
    //     });
    //     timeout.forget();
    // }
}
