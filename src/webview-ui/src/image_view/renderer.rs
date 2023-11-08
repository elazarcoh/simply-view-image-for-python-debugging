use std::iter::FromIterator;

use std::{cell::RefCell, collections::HashMap, rc::Rc};

use glam::{Mat3, Vec2, Vec3};

use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
};

use crate::common::Size;
use crate::image_view::camera;
use crate::math_utils::ToHom;
use crate::webgl_utils;
use crate::webgl_utils::attributes::{create_buffer_info_from_arrays, Arrays};
use crate::webgl_utils::constants::*;
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::types::*;

use super::constants::VIEW_SIZE;
use super::pixel_text_rendering::{
    PixelLoc, PixelTextCache, PixelTextRenderer, PixelTextRenderingData, PixelValue,
};
use super::rendering_context::{ImageViewData, RenderingContext};
use super::types::{all_views, TextureImage, ViewId};

struct Programs {
    image: ProgramBundle,
}

struct RenderingData {
    pixel_text_cache_per_view: HashMap<ViewId, PixelTextCache>,

    gl: GL,
    programs: Programs,
    text_renderer: PixelTextRenderer,

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
        log::debug!("Renderer::set_rendering_context");
        Renderer::setup_rendering_callback_if_ready(rendering_context);
    }

    fn setup_rendering_callback_if_ready(rendering_context: Rc<dyn RenderingContext>) {
        let gl = rendering_context.gl().clone();

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        let programs = Renderer::create_programs(&gl).unwrap();

        let image_plane_attributes =
            create_image_plane_attributes(&gl, 0.0, 0.0, VIEW_SIZE.width, VIEW_SIZE.height)
                .unwrap();

        let text_renderer = PixelTextRenderer::try_new(&gl).unwrap();

        let pixel_text_cache_per_view = HashMap::from_iter(
            all_views()
                .into_iter()
                .map(|v| (v, text_renderer.make_pixel_text_cache())),
        );

        let mut rendering_data = RenderingData {
            pixel_text_cache_per_view,
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
                } else {
                    Renderer::render(&gl, &mut rendering_data, rendering_context.as_ref());
                    Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
                }
            }
        }) as Box<dyn FnMut()>));

        Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
    }

    fn create_programs(gl: &WebGl2RenderingContext) -> Result<Programs, String> {
        let image_program = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image.frag"))
            .attribute("vin_position")
            .build()?;

        Ok(Programs {
            image: image_program,
        })
    }

    fn canvas(gl: &GL) -> HtmlCanvasElement {
        gl.canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap()
    }

    fn render(
        gl: &WebGl2RenderingContext,
        rendering_data: &mut RenderingData,
        rendering_context: &dyn RenderingContext,
    ) {
        let render_result = rendering_context
            .visible_nodes()
            .iter()
            .map(|view_id| {
                let view_data = rendering_context.view_data(*view_id);
                Renderer::render_view(gl, rendering_data, &view_data, rendering_context, view_id)
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
        _gl: &GL,
        image_size: &Size,
        view_projection: &Mat3,
        rendered_area_size: &Size,
    ) -> PixelsInformation {
        let tl_ndc: Vec3 = Vec2::new(-1.0, 1.0).to_hom();
        let br_ndc: Vec3 = Vec2::new(1.0, -1.0).to_hom();

        let image_pixels_to_view = Mat3::from_scale(Vec2::new(
            VIEW_SIZE.width / image_size.width,
            VIEW_SIZE.height / image_size.height,
        ));
        let view_projection_inv = (*view_projection * image_pixels_to_view).inverse();

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

        let pixel_size_device = (rendered_area_size.width / (brx - tlx)) as i32;

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
        view_name: &ViewId,
    ) -> Result<(), String> {
        if image_view_data.image_id.is_none()
            || rendering_context
                .texture_by_id(image_view_data.image_id.as_ref().unwrap())
                .is_none()
        {
            return Ok(());
        }
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

        let image_id = image_view_data.image_id.as_ref().ok_or(
            "Could not find texture for image_id. This should not happen, please report a bug.",
        )?;
        let texture = rendering_context.texture_by_id(image_id).ok_or(
            "Could not find texture for image_id. This should not happen, please report a bug.",
        )?;
        Renderer::render_image(
            rendering_context,
            rendering_data,
            texture,
            image_view_data,
            view_name,
        );

        Ok(())
    }

    fn render_image(
        rendering_context: &dyn RenderingContext,
        rendering_data: &mut RenderingData,
        texture: Rc<TextureImage>,
        image_view_data: &ImageViewData,
        view_name: &ViewId,
    ) {
        let gl = &rendering_data.gl;
        let program = &rendering_data.programs.image;
        let config = rendering_context.rendering_configuration();

        let html_element_size = Size {
            width: image_view_data.html_element.client_width() as f32,
            height: image_view_data.html_element.client_height() as f32,
        };
        let camera = &image_view_data.camera;

        let view_projection =
            camera::calculate_view_projection(&html_element_size, &VIEW_SIZE, camera);

        let pixels_info = Renderer::calculate_pixels_information(
            gl,
            &texture.image_size(),
            &view_projection,
            &html_element_size,
        );
        let enable_borders =
            pixels_info.image_pixel_size_device > config.minimum_size_to_render_pixel_border as _;
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

        let to_render_text =
            pixels_info.image_pixel_size_device > config.minimum_size_to_render_pixel_values as _;
        if to_render_text {
            let pixel_text_cache = rendering_data
                .pixel_text_cache_per_view
                .get_mut(view_name)
                .unwrap();

            for x in pixels_info.lower_x_px..pixels_info.upper_x_px {
                for y in pixels_info.lower_y_px..pixels_info.upper_y_px {
                    let image_pixels_to_view = Mat3::from_scale(Vec2::new(
                        VIEW_SIZE.width / texture.image_size().width,
                        VIEW_SIZE.height / texture.image_size().height,
                    ));

                    let pixel = PixelLoc::new(x as _, y as _);
                    let pixel_value = PixelValue::from_image(&texture.image, &pixel);

                    rendering_data.text_renderer.render(PixelTextRenderingData {
                        pixel_text_cache,
                        pixel_loc: &pixel,
                        pixel_value: &pixel_value,
                        image_coords_to_view_coord_mat: &image_pixels_to_view,
                        view_projection: &view_projection,
                    });
                }
            }
        }
    }
}
