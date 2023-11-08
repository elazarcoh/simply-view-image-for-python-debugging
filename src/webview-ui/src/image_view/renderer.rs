use std::ops::{Deref, IndexMut};
use std::{cell::RefCell, collections::HashMap, rc::Rc};

use image;
use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
    WebGlTexture,
};
use yew::NodeRef;

use crate::webgl_utils;
use crate::webgl_utils::attributes::{
    create_attributes_from_array, create_buffer_info_from_arrays, Arrays,
};
use crate::webgl_utils::constants::*;
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::types::*;

use super::image_view::ImageView;
use super::rendering_context::RenderingContext;

struct Programs {
    basic: ProgramBundle,
    image: ProgramBundle,
}

struct RenderingData {
    gl: GL,
    programs: Programs,

    image_plane_buffer: BufferInfo,
}

fn create_image_plane_attributes(
    gl: &GL,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
) -> Result<BufferInfo, String> {
    let centered_x = x - width / 2.0;
    let centered_y = y - height / 2.0;
    #[rustfmt::skip]
    let a_image_plane_position = ArraySpec {
        name: "vin_position".to_string(),
        data: (&[
            centered_x, centered_y, // bottom left
            centered_x, centered_y + height, // bottom right
            centered_x + width, centered_y, // top left
            centered_x + width, centered_y + height, // top right
        ] as &[f32]),
        num_components: 2,
        normalized: true,
        stride: None,
        target: BindingPoint::ArrayBuffer,
    };
    let indices = ArraySpec {
        name: "indices".to_string(),
        data: (&[0_u16, 1, 2, 1, 2, 3] as &[u16]),
        num_components: 3,
        normalized: false,
        stride: None,
        target: BindingPoint::ElementArrayBuffer,
    };
    let a_texture_uv = ArraySpec {
        name: "uv".to_string(),
        data: (&[
            0.0_f32, 0.0, // bottom left
            0.0, 1.0, // bottom right
            1.0, 0.0, // top left
            1.0, 1.0, // top right
        ] as &[f32]),
        num_components: 2,
        normalized: true,
        stride: None,
        target: BindingPoint::ArrayBuffer,
    };

    create_buffer_info_from_arrays(
        gl,
        Arrays {
            f32_arrays: vec![a_image_plane_position, a_texture_uv],
            u8_arrays: vec![],
        },
        Some(indices),
    )
}

pub struct Renderer {}

impl Renderer {
    pub fn new() -> Self {
        Self {}
    }

    fn request_animation_frame(f: &Closure<dyn FnMut()>) {
        web_sys::window()
            .unwrap()
            .request_animation_frame(f.as_ref().unchecked_ref())
            .expect("should register `requestAnimationFrame` OK");
    }

    pub fn set_rendering_context(&mut self, rendering_context: Rc<dyn RenderingContext>) {
        log::debug!("Renderer::bind_view_holders");
        Renderer::setup_rendering_callback_if_ready(rendering_context);
    }

    fn setup_rendering_callback_if_ready(rendering_context: Rc<dyn RenderingContext>) {
        let gl = rendering_context.gl().clone();

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        let programs = Renderer::create_programs(&gl).unwrap();

        let image_plane_attributes =
            create_image_plane_attributes(&gl, 0.0, 0.0, 1.0, 1.0).unwrap();

        let rendering_data = RenderingData {
            gl: gl.clone(),
            programs,
            image_plane_buffer: image_plane_attributes,
        };

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
                    return;
                } else {
                    Renderer::render(&gl, &rendering_data, rendering_context.as_ref());
                    // Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
                }
            }
        }) as Box<dyn FnMut()>));

        Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
    }

    fn create_programs(gl: &WebGl2RenderingContext) -> Result<Programs, String> {
        let vert_code = include_str!("../shaders/basic.vert");
        let frag_code = include_str!("../shaders/basic.frag");

        let shader_program = webgl_utils::GLProgramBuilder::new(&gl)
            .vertex_shader(vert_code)
            .fragment_shader(frag_code)
            .attribute("a_position")
            .build()?;

        let image_program = webgl_utils::GLProgramBuilder::new(&gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image.frag"))
            .attribute("vin_position");

        Ok(Programs {
            basic: shader_program,
            image: image_program.build()?,
        })
    }

    fn render(
        gl: &WebGl2RenderingContext,
        rendering_data: &RenderingData,
        rendering_context: &dyn RenderingContext,
    ) {
        let render_result = rendering_context
            .visible_nodes()
            .iter()
            .map(|(image_view, image_view_element)| {
                Renderer::render_view(
                    gl,
                    rendering_data,
                    image_view,
                    image_view_element,
                    rendering_context,
                )
            })
            .collect::<Result<Vec<_>, _>>();
        if let Err(e) = render_result {
            log::error!("Renderer::render: {}", e);
        }
    }

    fn render_view(
        gl: &WebGl2RenderingContext,
        rendering_data: &RenderingData,
        image_view: &ImageView,
        image_view_element: &HtmlElement,
        rendering_context: &dyn RenderingContext,
    ) -> Result<(), String> {
        let canvas = gl
            .canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap();
        let rect = image_view_element.get_bounding_client_rect();

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
        {
            let [r, g, b, a] = image_view.model.bg_color.unwrap_or([0.0, 0.0, 0.0, 1.0]);
            gl.clear_color(r, g, b, a);
        };
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

        // let basic_program = &rendering_data.programs.basic;
        // gl.use_program(Some(&basic_program.program));

        // let mut mat = glam::Mat4::IDENTITY;
        // *mat.col_mut(0).index_mut(0) = 0.5;

        // set_uniforms(
        //     &basic_program,
        //     &HashMap::from([
        //         ("u_time", UniformValue::Float(&0.5)),
        //         ("u_transform", UniformValue::Mat4(&mat)),
        //     ]),
        // );

        // if let Some(image_id) = &image_view.model.image_id {
        //     let t = rendering_context.texture_by_id(&image_id).ok_or(
        //         "Could not find texture for image_id. This should not happen, please report a bug.",
        //     )?;
        //     let texture = &t.texture;
        //     set_uniforms(
        //         &basic_program,
        //         &HashMap::from([("u_texture", UniformValue::Texture(&texture))]),
        //     );
        // }

        // let array_info: ArraySpec<&[f32]> = ArraySpec {
        //     name: "a_position".to_string(),
        //     data: (&[
        //         -0.5_f32, -0.5, // bottom left
        //         0.5, -0.5, // bottom right
        //         0.0, 0.5, // top
        //     ]),
        //     num_components: 2,
        //     normalized: true,
        //     stride: None,
        //     target: BindingPoint::ArrayBuffer,
        // };
        // let attr = webgl_utils::attributes::create_attributes_from_array(gl, array_info)?;
        // (basic_program
        //     .attribute_setters
        //     .get("a_position")
        //     .ok_or("Could not find attribute setter for a_position")?
        //     .setter)(&gl, &attr);

        // // Attach the time as a uniform for the GL context.
        // gl.draw_arrays(GL::TRIANGLES, 0, 6);

        let image_id = image_view.model.image_id.as_ref().ok_or(
            "Could not find texture for image_id. This should not happen, please report a bug.",
        )?;
        let texture = rendering_context.texture_by_id(&image_id).ok_or(
            "Could not find texture for image_id. This should not happen, please report a bug.",
        )?;
        Renderer::render_image(rendering_data, &texture.texture);

        Ok(())
    }

    fn render_image(rendering_data: &RenderingData, texture: &WebGlTexture) {
        let gl = &rendering_data.gl;
        let program = &rendering_data.programs.image;

        gl.use_program(Some(&program.program));
        set_uniforms(
            program,
            &HashMap::from([("u_texture", UniformValue::Texture(&texture))]),
        );
        set_buffers_and_attributes(program, &rendering_data.image_plane_buffer);
        log::debug!("render_image: draw_buffer_info");
        draw_buffer_info(gl, &rendering_data.image_plane_buffer, DrawMode::Triangles);
    }
}
