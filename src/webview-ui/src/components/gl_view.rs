use gloo::console;
use gloo_timers::callback::Interval;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{ HtmlCanvasElement, HtmlElement, WebGl2RenderingContext };
use yew::prelude::*;
use yew_hooks::use_raf;

use crate::components::renderer_context::RendererContext;
use crate::renderer::{ InSingleViewName, InViewName, Renderer };

// use crate::components::glcontext::use_gl_context;
// use crate::components::GL;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub view_name: InViewName,
}

#[function_component]
pub fn GLView(props: &Props) -> Html {
    let div_ref = use_node_ref();

    let renderer_ctx = use_context::<RendererContext>();
    if let Some(renderer_ctx) = renderer_ctx {
        log::debug!("GLView got renderer");
        let renderer = renderer_ctx.renderer;
        (*renderer.borrow_mut()).register(props.view_name.clone(), div_ref.clone());
    } else {
        log::error!("GLView no renderer");
    }

    html! {
        <div>
            <p>{ "Above" }</p>
            <div ref={div_ref}>
                <p>{ "Placeholder: " }</p>
            </div>
            <p>{ "Below" }</p>
        </div>
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
