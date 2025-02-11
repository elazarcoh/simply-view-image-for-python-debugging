use std::{cell::RefCell, rc::Rc};

use wasm_bindgen::prelude::*;
use web_sys::WebGl2RenderingContext;

use super::colorbar_renderer::ColorBarRenderer;
use super::image_renderer::ImageRenderer;
use super::rendering_context::RenderingContext;
use super::utils::gl_canvas;

pub(crate) struct Renderer {}

impl Renderer {
    pub(crate) fn new() -> Self {
        Self {}
    }

    fn request_animation_frame(f: &Closure<dyn FnMut()>) {
        web_sys::window()
            .unwrap()
            .request_animation_frame(f.as_ref().unchecked_ref())
            .expect("should register `requestAnimationFrame` OK");
    }

    pub(crate) fn setup_rendering(&mut self, rendering_context: Rc<dyn RenderingContext>) {
        log::debug!("Renderer::set_rendering_context");
        Renderer::setup_rendering_callback_if_ready(rendering_context);
    }

    fn setup_rendering_callback_if_ready(rendering_context: Rc<dyn RenderingContext>) {
        let gl = rendering_context.gl().clone();

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        let mut render_image =
            ImageRenderer::setup_rendering_callback(Rc::clone(&rendering_context))
                .expect("Could not setup rendering callback");
        let mut render_colorbar =
            ColorBarRenderer::setup_rendering_callback(Rc::clone(&rendering_context))
                .expect("Could not setup rendering callback");

        // Gloo-render's request_animation_frame has this extra closure
        // wrapping logic running every frame, unnecessary cost.
        // Here constructing the wrapped closure just once.
        let cb = Rc::new(RefCell::new(None));

        *cb.borrow_mut() = Some(Closure::wrap(Box::new({
            let cb = Rc::clone(&cb);
            move || {
                if gl.is_context_lost() {
                    // Drop our handle to this closure so that it will get cleaned
                    // up once we return.
                    let _ = cb.borrow_mut().take();
                } else {
                    // Clean the canvas
                    gl.clear_color(0.0, 0.0, 0.0, 0.0);
                    gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

                    let canvas = gl_canvas(&gl);

                    // The following two lines set the size (in CSS pixels) of
                    // the drawing buffer to be identical to the size of the
                    // canvas HTML element, as determined by CSS.
                    canvas.set_width(canvas.client_width() as _);
                    canvas.set_height(canvas.client_height() as _);

                    render_image();

                    render_colorbar();

                    Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
                }
            }
        }) as Box<dyn FnMut()>));

        Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
    }
}
