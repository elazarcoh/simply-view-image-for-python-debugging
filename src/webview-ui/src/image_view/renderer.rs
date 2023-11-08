use std::iter::FromIterator;

use std::{cell::RefCell, collections::HashMap, rc::Rc};

use glam::{Mat3, UVec2, Vec2, Vec3};

use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
};

use crate::common::Size;
use crate::communication::incoming_messages::Datatype;
use crate::image_view::camera;
use crate::math_utils::ToHom;
use crate::math_utils::image_calculations::calculate_pixels_information;
use crate::webgl_utils;
use crate::webgl_utils::attributes::{create_buffer_info_from_arrays, Arrays};
use crate::webgl_utils::constants::*;
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::types::*;

use super::color_matix::calculate_color_matrix;
use super::constants::VIEW_SIZE;
use super::pixel_text_rendering::{PixelTextCache, PixelTextRenderer, PixelTextRenderingData};
use super::rendering_context::{ImageViewData, RenderingContext};
use super::types::{all_views, Coloring, PixelValue, TextureImage, ViewId};

struct Programs {
    normalized_image: ProgramBundle,
    uint_image: ProgramBundle,
    int_image: ProgramBundle,
}

struct RenderingData {
    pixel_text_cache_per_view: HashMap<ViewId, PixelTextCache>,

    gl: GL,
    programs: Programs,
    text_renderer: PixelTextRenderer,
    placeholder_texture: GLGuard<web_sys::WebGlTexture>,

    image_plane_buffer: BufferInfo,
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

fn create_placeholder_texture(gl: &GL) -> Result<GLGuard<web_sys::WebGlTexture>, String> {
    const PLACEHOLDER_BYTES: &[u8] = &[0, 0, 0, 0];
    webgl_utils::textures::create_texture_from_bytes(
        gl,
        PLACEHOLDER_BYTES,
        1, // width
        1, // height
        1, // channels
        Datatype::Float32,
        webgl_utils::types::CreateTextureParametersBuilder::default()
            .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
            .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
            .wrap_s(webgl_utils::constants::TextureWrap::ClampToEdge)
            .wrap_t(webgl_utils::constants::TextureWrap::ClampToEdge)
            .build()
            .unwrap(),
    )
}

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

    pub(crate) fn set_rendering_context(&mut self, rendering_context: Rc<dyn RenderingContext>) {
        log::debug!("Renderer::set_rendering_context");
        Renderer::setup_rendering_callback_if_ready(rendering_context);
    }

    fn setup_rendering_callback_if_ready(rendering_context: Rc<dyn RenderingContext>) {
        let gl = rendering_context.gl().clone();

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        let programs = Renderer::create_programs(&gl).unwrap();

        let placeholder_texture = create_placeholder_texture(&gl).unwrap();

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
            placeholder_texture,
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
        let normalized_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image-normalized.frag"))
            .attribute("vin_position")
            .build()?;
        let uint_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image-uint.frag"))
            .attribute("vin_position")
            .build()?;
        let int_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image-int.frag"))
            .attribute("vin_position")
            .build()?;

        Ok(Programs {
            normalized_image,
            uint_image,
            int_image,
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
        let program = match texture.image.info.datatype {
            Datatype::Uint8 => &rendering_data.programs.uint_image,
            Datatype::Uint16 => &rendering_data.programs.uint_image,
            Datatype::Uint32 => &rendering_data.programs.uint_image,
            Datatype::Float32 => &rendering_data.programs.normalized_image,
            Datatype::Int8 => &rendering_data.programs.int_image,
            Datatype::Int16 => &rendering_data.programs.int_image,
            Datatype::Int32 => &rendering_data.programs.int_image,
            Datatype::Bool => &rendering_data.programs.uint_image,
        };
        let config = rendering_context.rendering_configuration();

        let html_element_size = Size {
            width: image_view_data.html_element.client_width() as f32,
            height: image_view_data.html_element.client_height() as f32,
        };
        let camera = &image_view_data.camera;

        let view_projection =
            camera::calculate_view_projection(&html_element_size, &VIEW_SIZE, camera);

        let pixels_info = calculate_pixels_information(
            &texture.image_size(),
            &view_projection,
            &html_element_size,
        );
        let enable_borders =
            pixels_info.image_pixel_size_device > config.minimum_size_to_render_pixel_border as _;
        let image_size = texture.image_size();
        let image_size_vec = Vec2::new(image_size.width, image_size.height);

        let drawing_options =
            rendering_context.drawing_options(image_view_data.image_id.as_ref().unwrap());
        let (color_multiplier, u_color_addition) = calculate_color_matrix(
            &texture.image.info,
            &texture.image.computed_info,
            &drawing_options,
        );

        let mut uniform_values = HashMap::from([
            ("u_texture", UniformValue::Texture(&texture.texture)),
            ("u_projectionMatrix", UniformValue::Mat3(&view_projection)),
            ("u_enable_borders", UniformValue::Bool(&enable_borders)),
            ("u_buffer_dimension", UniformValue::Vec2(&image_size_vec)),
            ("u_color_multiplier", UniformValue::Mat4(&color_multiplier)),
            ("u_color_addition", UniformValue::Vec4(&u_color_addition)),
            ("u_invert", UniformValue::Bool(&drawing_options.invert)),
        ]);

        let colormap_texture = if let Coloring::Heatmap { name } = drawing_options.coloring {
            let color_map_texture = rendering_context
                .get_color_map_texture(&name)
                .expect("Could not get color map texture");

            let tex = color_map_texture.obj.clone();
            Some(tex)
        } else if let Coloring::Segmentation { name } = drawing_options.coloring {
            let color_map_texture = rendering_context
                .get_color_map_texture(&name)
                .expect("Could not get color map texture");

            let tex = color_map_texture.obj.clone();
            Some(tex)
        } else {
            None
        };

        if colormap_texture.is_some() {
            uniform_values.insert(
                "u_colormap",
                UniformValue::Texture(colormap_texture.as_ref().unwrap()),
            );
            uniform_values.insert("u_use_colormap", UniformValue::Bool(&true));
        } else {
            uniform_values.insert("u_use_colormap", UniformValue::Bool(&false));
            uniform_values.insert(
                "u_colormap",
                UniformValue::Texture(&rendering_data.placeholder_texture),
            );
        }

        gl.use_program(Some(&program.program));
        set_uniforms(program, &uniform_values);
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

                    let pixel = UVec2::new(x as _, y as _);
                    let pixel_value = PixelValue::from_image(&texture.image, &pixel);

                    rendering_data.text_renderer.render(PixelTextRenderingData {
                        pixel_text_cache,
                        pixel_loc: &pixel,
                        pixel_value: &pixel_value,
                        image_coords_to_view_coord_mat: &image_pixels_to_view,
                        view_projection: &view_projection,
                        invert: drawing_options.invert,
                        ignoring_alpha: drawing_options.ignore_alpha,
                    });
                }
            }
        }
    }
}
