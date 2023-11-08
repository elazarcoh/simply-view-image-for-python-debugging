use std::ops::{Deref, IndexMut};
use std::{cell::RefCell, collections::HashMap, rc::Rc};

use glam::{Mat3, Vec2, Vec3};
use glyph_brush::Section;
use image::{self, DynamicImage};
use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
    WebGlTexture,
};
use yew::NodeRef;

use crate::common::Size;
use crate::image_view::camera;
use crate::math_utils::ToHom;
use crate::webgl_utils::attributes::{
    create_attributes_from_array, create_buffer_info_from_arrays, Arrays,
};
use crate::webgl_utils::constants::*;
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::types::*;
use crate::{math_utils, webgl_utils};

use super::camera::Camera;
use super::constants::VIEW_SIZE;
use super::rendering_context::{ImageViewData, RenderingContext};
use super::text_rendering::TextRenderer;
use super::types::TextureImage;

struct Programs {
    basic: ProgramBundle,
    image: ProgramBundle,
}

struct RenderingData {
    gl: GL,
    programs: Programs,
    text_renderer: TextRenderer,

    image_plane_buffer: BufferInfo,
}

#[derive(Debug)]
struct PixelsInformation {
    lower_x_px: i32,
    lower_y_px: i32,
    upper_x_px: i32,
    upper_y_px: i32,

    image_pixel_size_device: i32, // assume square pixels
}

fn create_image_plane_attributes(
    gl: &GL,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
) -> Result<BufferInfo, String> {
    #[rustfmt::skip]
    let a_image_plane_position = ArraySpec {
        name: "vin_position".to_string(),
        data: (&[
            x, y, // bottom left
            x, y + height, // bottom right
            x + width, y, // top left
            x + width, y + height, // top right
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
            u8_arrays: vec![] as Vec<ArraySpec<Vec<u8>>>,
        },
        Some(indices),
    )
}

struct PixelValueFormatter {}

struct FormattedPixelValue {
    section: glyph_brush::OwnedSection,
    text_to_image: Mat3,
}

impl PixelValueFormatter {
    fn format_pixel_value(image: &image::DynamicImage, x: i32, y: i32) -> FormattedPixelValue {
        let font_scale = 100.0;
        let max_rows = 3_f32;
        let max_cols = 5_f32;
        let max_rows_cols = f32::max(max_rows, max_cols);
        let letters_offset_inside_pixel = max_rows_cols / 2.0;
        let pixel_offset = max_rows_cols;
        let px = 0.0;
        let py = 0.0;

        // let text = ("M".repeat(num_cols as usize) + "\n").repeat(num_rows as usize);
        let text = match image {
            DynamicImage::ImageRgba8(image)=> {
                let pixel = image.get_pixel(x as u32, y as u32);
                format!("{:.5}\n{:.5}\n{:.5}\n{:.5}", pixel[0], pixel[1], pixel[2], pixel[3])
            },
            _ => "Not RGBA".to_string(),
        };

        let text_to_image = Mat3::from_scale(Vec2::new(
            (1.0 / max_rows_cols) / (font_scale),
            (1.0 / max_rows_cols) / (font_scale),
        ));

        let section = glyph_brush::Section::default()
            .add_text(glyph_brush::Text::new(&text).with_scale(font_scale))
            .with_layout(
                glyph_brush::Layout::default()
                    .h_align(glyph_brush::HorizontalAlign::Center)
                    .v_align(glyph_brush::VerticalAlign::Center),
            )
            .with_screen_position((
                ((x as f32 + px) * pixel_offset + letters_offset_inside_pixel) * font_scale,
                ((y as f32 + py) * pixel_offset + letters_offset_inside_pixel) * font_scale,
            )).to_owned();

        FormattedPixelValue {
            section,
            text_to_image,
        }
    }
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
            create_image_plane_attributes(&gl, 0.0, 0.0, VIEW_SIZE.width, VIEW_SIZE.height)
                .unwrap();

        let text_renderer = TextRenderer::try_new(gl.clone()).unwrap();

        let mut rendering_data = RenderingData {
            gl: gl.clone(),
            programs,
            text_renderer,
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
                    Renderer::render(&gl, &mut rendering_data, rendering_context.as_ref());
                    // Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
                }
            }
        }) as Box<dyn FnMut()>));

        Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
    }

    fn create_programs(gl: &WebGl2RenderingContext) -> Result<Programs, String> {
        let vert_code = include_str!("../shaders/basic.vert");
        let frag_code = include_str!("../shaders/basic.frag");

        let shader_program = webgl_utils::program::GLProgramBuilder::new(&gl)
            .vertex_shader(vert_code)
            .fragment_shader(frag_code)
            .attribute("a_position")
            .build()?;

        let image_program = webgl_utils::program::GLProgramBuilder::new(&gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image.frag"))
            .attribute("vin_position")
            .build()?;

        Ok(Programs {
            basic: shader_program,
            image: image_program,
        })
    }

    fn canvas(gl: &GL) -> HtmlCanvasElement {
        let canvas = gl
            .canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap();
        canvas
    }

    fn render(
        gl: &WebGl2RenderingContext,
        rendering_data: &mut RenderingData,
        rendering_context: &dyn RenderingContext,
    ) {
        let render_result = rendering_context
            .visible_nodes()
            .iter()
            .map(|image_view| {
                let view_data = rendering_context.view_data(*image_view);
                Renderer::render_view(gl, rendering_data, &view_data, rendering_context)
            })
            .collect::<Result<Vec<_>, _>>();

        if let Err(e) = render_result {
            log::error!("Renderer::render: {}", e);
        }
    }

    fn scissor_view(gl: &WebGl2RenderingContext, image_view_element: &HtmlElement) {
        let canvas = Renderer::canvas(gl);

        let rect = image_view_element.get_bounding_client_rect();
        let width = rect.right() - rect.left();
        let height = rect.bottom() - rect.top();
        let left = rect.left();
        let bottom = canvas.client_height() as f64 - rect.bottom();

        gl.viewport(left as i32, bottom as i32, width as i32, height as i32);
        gl.scissor(left as i32, bottom as i32, width as i32, height as i32);
    }

    fn calculate_pixels_information(
        gl: &GL,
        camera: &Camera,
        image_size: &Size,
    ) -> PixelsInformation {
        let canvas = Renderer::canvas(gl);
        let canvas_size = Size {
            width: canvas.width() as f32,
            height: canvas.height() as f32,
        };
        let tl_ndc: Vec3 = Vec2::new(-1.0, 1.0).to_hom();
        let br_ndc: Vec3 = Vec2::new(1.0, -1.0).to_hom();

        let view_projection = camera::calculate_view_projection(&canvas_size, &VIEW_SIZE, camera);
        let image_pixels_to_view = Mat3::from_scale(Vec2::new(
            VIEW_SIZE.width / image_size.width,
            VIEW_SIZE.height / image_size.height,
        ));
        let view_projection_inv = (view_projection * image_pixels_to_view).inverse();

        let tl_world = view_projection_inv * tl_ndc;
        let br_world = view_projection_inv * br_ndc;

        let tlx = f32::min(tl_world.x, br_world.x);
        let tly = f32::min(tl_world.y, br_world.y);
        let brx = f32::max(tl_world.x, br_world.x);
        let bry = f32::max(tl_world.y, br_world.y);

        let tl = Vec2::new(tlx, tly);
        let br = Vec2::new(brx, bry);

        let lower_x_px = i32::max(0, (f32::floor(tl.x) as i32) - 1);
        let lower_y_px = i32::max(0, (f32::floor(tl.y) as i32) - 1);
        let upper_x_px = i32::min(image_size.width as i32, (f32::ceil(br.x) as i32) + 1);
        let upper_y_px = i32::min(image_size.height as i32, (f32::ceil(br.y) as i32) + 1);

        let pixel_size_device = (canvas_size.width / (brx - tlx)) as i32;

        PixelsInformation {
            lower_x_px,
            lower_y_px,
            upper_x_px,
            upper_y_px,
            image_pixel_size_device: pixel_size_device,
        }
    }

    fn render_view(
        gl: &WebGl2RenderingContext,
        rendering_data: &mut RenderingData,
        image_view_data: &ImageViewData,
        rendering_context: &dyn RenderingContext,
    ) -> Result<(), String> {
        let canvas = Renderer::canvas(gl);

        // The following two lines set the size (in CSS pixels) of
        // the drawing buffer to be identical to the size of the
        // canvas HTML element, as determined by CSS.
        canvas.set_width(canvas.client_width() as _);
        canvas.set_height(canvas.client_height() as _);

        Renderer::scissor_view(gl, &image_view_data.html_element);

        {
            let [r, g, b, a] = [0.0, 0.0, 1.0, 1.0];
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

        let image_id = image_view_data.image_id.as_ref().ok_or(
            "Could not find texture for image_id. This should not happen, please report a bug.",
        )?;
        let texture = rendering_context.texture_by_id(&image_id).ok_or(
            "Could not find texture for image_id. This should not happen, please report a bug.",
        )?;
        Renderer::render_image(rendering_data, texture, image_view_data);

        Ok(())
    }

    fn render_image(
        rendering_data: &mut RenderingData,
        texture: Rc<TextureImage>,
        image_view_data: &ImageViewData,
    ) {
        let gl = &rendering_data.gl;
        let program = &rendering_data.programs.image;

        let canvas = Renderer::canvas(gl);
        let canvas_size = Size {
            width: canvas.width() as f32,
            height: canvas.height() as f32,
        };
        let camera = &image_view_data.camera;
        // let camera = &Camera {
        //     zoom: 6.0,
        //     translation: Vec2::new(-50.0, 0.0),
        // };
        let view_projection = camera::calculate_view_projection(&canvas_size, &VIEW_SIZE, camera);

        let pixels_info = Renderer::calculate_pixels_information(gl, camera, &texture.image_size());
        let enable_borders = pixels_info.image_pixel_size_device > 30; // TODO: make this configurable/constant
        let image_size = texture.image_size();
        let image_size_vec = Vec2::new(image_size.width, image_size.height);

        gl.use_program(Some(&program.program));
        set_uniforms(
            program,
            &HashMap::from([
                ("u_texture", UniformValue::Texture(&texture.texture)),
                ("u_projectionMatrix", UniformValue::Mat3(&view_projection)),
                ("u_enable_borders", UniformValue::Bool(&enable_borders)),
                ("u_buffer_dimension", UniformValue::Vec2(&image_size_vec)),
            ]),
        );
        set_buffers_and_attributes(program, &rendering_data.image_plane_buffer);
        draw_buffer_info(gl, &rendering_data.image_plane_buffer, DrawMode::Triangles);

        for x in pixels_info.lower_x_px..pixels_info.upper_x_px {
            for y in pixels_info.lower_y_px..pixels_info.upper_y_px {
                let formatted_pixel_value =
                    PixelValueFormatter::format_pixel_value(&texture.image, x, y);

                rendering_data
                    .text_renderer
                    .queue_section(formatted_pixel_value.section.to_borrowed());
                let image_pixels_to_view = Mat3::from_scale(Vec2::new(
                    VIEW_SIZE.width / texture.image_size().width,
                    VIEW_SIZE.height / texture.image_size().height,
                ));
                // rescale the font to a single pixel
                let text_to_image = formatted_pixel_value.text_to_image;
                let text_to_view = image_pixels_to_view * text_to_image;
                rendering_data
                    .text_renderer
                    .render(&text_to_view, &view_projection);
            }
        }
        // render text
        // let font_scale = 100.0;
        // let num_rows = 3_f32;
        // let num_cols = 5_f32;
        // let max_rows_cols = f32::max(num_rows, num_cols);
        // let letters_offset_inside_pixel = max_rows_cols / 2.0;
        // let pixel_offset = max_rows_cols;
        // let px = 0.0;
        // let py = 0.0;
        // let text = ("M".repeat(num_cols as usize) + "\n").repeat(num_rows as usize);
        // rendering_data.text_renderer.queue_section(
        //     glyph_brush::Section::default()
        //         .add_text(glyph_brush::Text::new(&text).with_scale(font_scale))
        //         // .with_bounds((pixels_info.image_pixel_size_device as f32, pixels_info.image_pixel_size_device as f32))
        //         .with_layout(
        //             glyph_brush::Layout::default()
        //                 .h_align(glyph_brush::HorizontalAlign::Center)
        //                 .v_align(glyph_brush::VerticalAlign::Center),
        //         )
        //         .with_screen_position((
        //             (px * pixel_offset + letters_offset_inside_pixel) * font_scale,
        //             (py * pixel_offset + letters_offset_inside_pixel) * font_scale,
        //         )),
        // );
        // rendering_data.text_renderer.queue_section(
        //     glyph_brush::Section::default()
        //         .add_text(glyph_brush::Text::new(&text).with_scale(font_scale))
        //         // .with_bounds((pixels_info.image_pixel_size_device as f32, pixels_info.image_pixel_size_device as f32))
        //         .with_layout(
        //             glyph_brush::Layout::default()
        //                 .h_align(glyph_brush::HorizontalAlign::Center)
        //                 .v_align(glyph_brush::VerticalAlign::Center),
        //         )
        //         .with_screen_position((
        //             ((px + 1.0) * pixel_offset + letters_offset_inside_pixel) * font_scale,
        //             (py * pixel_offset + letters_offset_inside_pixel) * font_scale,
        //         )),
        // );
        // let image_pixels_to_view = Mat3::from_scale(Vec2::new(
        //     VIEW_SIZE.width / texture.image_size().width,
        //     VIEW_SIZE.height / texture.image_size().height,
        // ));
        // // rescale the font to a single pixel
        // let text_to_image = Mat3::from_scale(Vec2::new(
        //     (1.0 / max_rows_cols) / (font_scale),
        //     (1.0 / max_rows_cols) / (font_scale),
        // ));
        // let text_to_view = image_pixels_to_view * text_to_image;
        // rendering_data
        //     .text_renderer
        //     .render(&text_to_view, &view_projection);
    }
}
