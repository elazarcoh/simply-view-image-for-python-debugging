use std::cell::RefCell;
use std::rc::Rc;

use gloo::console;
use wasm_bindgen::JsCast;

use stylist::yew::use_style;
use web_sys::{HtmlCanvasElement, WebGl2RenderingContext};
use yew::prelude::*;
use yew::{function_component, html, use_effect_with_deps, use_node_ref, Html};

use crate::renderer::Renderer;

#[derive(Properties, PartialEq)]
pub struct RendererProviderProps {
    pub renderer: Rc<RefCell<Renderer>>,
    #[prop_or_default]
    pub children: Children,
}

#[derive(Clone, PartialEq)]
pub struct RendererContext {
    pub renderer: Rc<RefCell<Renderer>>,
}

// #[styled_component]
#[function_component]
pub fn RendererProvider(props: &RendererProviderProps) -> Html {
    let renderer = props.renderer.clone();
    let renderer_ctx = use_memo(|_| RendererContext { renderer }, ());
    let canvas_ref = use_node_ref();

    {
        let canvas_ref = canvas_ref.clone();
        let renderer_ctx = renderer_ctx.clone();
        use_effect_with_deps(
            move |canvas_ref| {
                let canvas = canvas_ref
                    .cast::<HtmlCanvasElement>()
                    .expect("canvas_ref not attached to a canvas element");

                let gl: WebGl2RenderingContext = canvas
                    .get_context("webgl2")
                    .unwrap()
                    .unwrap()
                    .dyn_into()
                    .unwrap();

                console::log!("GL context created");

                (*renderer_ctx.renderer).borrow_mut().bind_gl(gl);

                move || {
                    (*renderer_ctx.renderer).borrow_mut().unbind_gl();
                }
            },
            canvas_ref,
        );
    }

    let canvas_style = use_style!(
        r#"
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
    "#,
    );

    html! {
        <ContextProvider<RendererContext> context={(*renderer_ctx).clone()}>
            <canvas id="gl-canvas" ref={canvas_ref} class={canvas_style}></canvas>
            {props.children.clone()}
        </ContextProvider<RendererContext>>
    }
}
