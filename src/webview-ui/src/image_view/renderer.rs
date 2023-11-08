use std::ops::Deref;
use std::{cell::RefCell, collections::HashMap, iter::FromIterator, rc::Rc};

use image;
use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
    WebGlTexture,
};
use yew::NodeRef;

use crate::webgl_utils;
use crate::webgl_utils::textures::create_texture_from_image;
use crate::webgl_utils::types::{
    take_into_owned, ArrayData, ArraySpec, CreateTextureParameters, CreateTextureParametersBuilder,
    TextureMagFilter, TextureMinFilter,
};

use super::image_view::ImageView;
use super::image_views_coordinator::ViewHolders;

pub struct Renderer {
    gl: Option<WebGl2RenderingContext>,
    view_holders: Option<Rc<ViewHolders>>,
    tmp_img: Option<image::DynamicImage>,
}

impl PartialEq for Renderer {
    fn eq(&self, other: &Self) -> bool {
        self.gl == other.gl
            && (self.view_holders.is_none() && other.view_holders.is_none()
                || self.view_holders.is_some()
                    && other.view_holders.is_some()
                    && Rc::ptr_eq(
                        self.view_holders.as_ref().unwrap(),
                        other.view_holders.as_ref().unwrap(),
                    ))
    }
}

impl Renderer {
    pub fn new() -> Self {
        Self {
            gl: None,
            view_holders: None,
            tmp_img: None,
        }
    }

    fn request_animation_frame(f: &Closure<dyn FnMut()>) {
        web_sys::window()
            .unwrap()
            .request_animation_frame(f.as_ref().unchecked_ref())
            .expect("should register `requestAnimationFrame` OK");
    }

    pub fn bind_view_holders(&mut self, view_holders: Rc<ViewHolders>) {
        log::debug!("Renderer::bind_view_holders");
        self.view_holders = Some(view_holders);
        self.setup_rendering_callback_if_ready();
    }

    pub fn bind_gl(&mut self, gl: WebGl2RenderingContext) {
        log::debug!("Renderer::bind_gl");

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        self.gl = Some(gl);
        self.setup_rendering_callback_if_ready();
    }

    pub fn unbind_gl(&mut self) {
        log::debug!("Renderer::unbind_gl");
        self.gl = None;
    }

    fn setup_rendering_callback_if_ready(&self) {
        if let (Some(gl), Some(view_holders)) = (self.gl.as_ref(), self.view_holders.as_ref()) {
            // Gloo-render's request_animation_frame has this extra closure
            // wrapping logic running every frame, unnecessary cost.
            // Here constructing the wrapped closure just once.

            let cb = Rc::new(RefCell::new(None));

            let texture = {
                let solid_image_data =
                    image::ImageBuffer::from_fn(256, 256, |x, y| image::Rgba([255u8, 255, 0, 255]));
                let solid_image = image::DynamicImage::ImageRgba8(solid_image_data);

                let tex = create_texture_from_image(
                    &gl,
                    &solid_image,
                    CreateTextureParametersBuilder::default()
                        .mag_filter(TextureMagFilter::Nearest)
                        .min_filter(TextureMinFilter::Nearest)
                        .build()
                        .unwrap(),
                )
                .unwrap();

                Some(take_into_owned(tex))
            };

            *cb.borrow_mut() = Some(Closure::wrap(Box::new({
                let cb = Rc::clone(&cb);
                let gl = gl.clone();
                let view_holders = Rc::clone(view_holders);
                move || {
                    if gl.is_context_lost() {
                        // Drop our handle to this closure so that it will get cleaned
                        // up once we return.
                        let _ = cb.borrow_mut().take();
                        return;
                    } else {
                        Renderer::render(&gl, &view_holders, texture.as_ref());
                        // Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
                    }
                }
            }) as Box<dyn FnMut()>));

            Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
        }
    }

    // pub fn put_image_to_view(&mut self, view_id: InViewName, image_id: &str) {
    //     log::debug!("Renderer::put_image_to_view({:?}, {})", view_id, image_id);
    //     let view_id = match view_id {
    //         InViewName::Single(v) => (ViewsType::Single, v.to_string()),
    //         InViewName::Dual(v) => (ViewsType::Dual, v.to_string()),
    //         InViewName::Quad(v) => (ViewsType::Quad, v.to_string()),
    //     };
    //     self.view_holders
    //         .borrow_mut()
    //         .0
    //         .get_mut(&view_id.0)
    //         .unwrap()
    //         .get_mut(&view_id.1)
    //         .unwrap()
    //         .data
    //         .image_id = Some(image_id.to_string());
    // }

    fn render(
        gl: &WebGl2RenderingContext,
        view_holders: &Rc<ViewHolders>,
        texture: Option<&WebGlTexture>,
    ) {
        let render_result = view_holders
            .visible_nodes()
            .iter()
            .map(|(v, e)| Renderer::render_view(gl, v, e, texture))
            .collect::<Result<Vec<_>, _>>();
        if let Err(e) = render_result {
            log::error!("Renderer::render: {}", e);
        }
    }

    fn render_view(
        gl: &WebGl2RenderingContext,
        v: &ImageView,
        e: &HtmlElement,
        texture: Option<&WebGlTexture>,
    ) -> Result<(), String> {
        let canvas = gl
            .canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap();
        let rect = e.get_bounding_client_rect();

        // The following two lines set the size (in CSS pixels) of
        // the drawing buffer to be identical to the size of the
        // canvas HTML element, as determined by CSS.
        canvas.set_width(canvas.client_width() as u32);
        canvas.set_height(canvas.client_height() as u32);

        let width = rect.right() - rect.left();
        let height = rect.bottom() - rect.top();
        let left = rect.left();
        let bottom = gl
            .canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap()
            .client_height() as f64
            - rect.bottom();

        gl.viewport(left as i32, bottom as i32, width as i32, height as i32);
        gl.scissor(left as i32, bottom as i32, width as i32, height as i32);

        gl.clear_color(1.0, 0.0, 0.0, 1.0);
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

        let vert_code = include_str!("../shaders/basic.vert");
        let frag_code = include_str!("../shaders/basic.frag");

        let array_info: ArraySpec<&[f32]> = ArraySpec {
            name: "a_position".to_string(),
            data: ArrayData::Slice(&[
                -0.5_f32, -0.5, // bottom left
                0.5, -0.5, // bottom right
                0.0, 0.5, // top
            ]),
            num_components: 2,
            normalized: true,
            stride: None,
        };
        let attr = webgl_utils::attributes::create_attributes_from_array(gl, array_info)?;

        let shader_program = webgl_utils::GLProgramBuilder::new(&gl)
            .vertex_shader(vert_code)
            .fragment_shader(frag_code)
            .attribute("a_position")
            .build()?;

        gl.use_program(Some(&shader_program.program));

        (shader_program
            .attribute_setters
            .get("a_position")
            .ok_or("Could not find attribute setter for a_position")?
            .setter)(&gl, &attr);

        shader_program.uniform_setters.get("u_time").unwrap()(&gl, &0.5);
        let t = texture.ok_or("no texture")?;
        shader_program
            .uniform_setters
            .get("u_texture")
            .ok_or("could not find setter for u_texture")?(&gl, t);

        // Attach the time as a uniform for the GL context.
        gl.draw_arrays(GL::TRIANGLES, 0, 6);

        Ok(())
    }
}
