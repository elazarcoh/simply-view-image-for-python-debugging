use gloo::console;
use gloo_timers::callback::Interval;
use stylist::yew::use_style;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{ HtmlCanvasElement, HtmlElement, WebGl2RenderingContext };
use yew::prelude::*;
use yew_hooks::use_raf;

use crate::components::renderer_context::RendererContext;

// use crate::components::glcontext::use_gl_context;
// use crate::components::GL;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub node_ref: NodeRef,
}

#[function_component]
pub fn GLView(props: &Props) -> Html {


    let image_view_style = use_style!(
        r#"
        height: 100%;
        width: 100%;
        border: 1px solid #0000ff;
    "#,
    );


    html! {
        <div ref={props.node_ref.clone()} class={image_view_style} />
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
