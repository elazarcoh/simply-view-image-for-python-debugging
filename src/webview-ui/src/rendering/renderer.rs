use anyhow::Ok;
use anyhow::Result;
use itertools::Itertools;
use std::iter::FromIterator;

use std::{cell::RefCell, collections::HashMap, rc::Rc};

use glam::{Mat3, UVec2, Vec2, Vec4};

use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
};

use crate::coloring;
use crate::coloring::{calculate_color_matrix, Coloring, DrawingOptions};
use crate::common::camera;
use crate::common::constants::all_views;
use crate::common::pixel_value::PixelValue;
use crate::common::texture_image::TextureImage;
use crate::common::texture_image::TexturesGroup;
use crate::common::Channels;
use crate::common::DataOrdering;
use crate::common::Datatype;
use crate::common::Size;
use crate::common::ViewId;
use crate::math_utils::image_calculations::calc_num_bytes_per_image;
use crate::math_utils::image_calculations::calculate_pixels_information;
use crate::webgl_utils;
use crate::webgl_utils::attributes::{create_buffer_info_from_arrays, Arrays};
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::types::*;

use super::constants::VIEW_SIZE;
use super::rendering_context::{ImageViewData, RenderingContext};
use crate::rendering::pixel_text_rendering::{
    PixelTextCache, PixelTextRenderer, PixelTextRenderingData,
};

struct Programs {
    normalized_image: ProgramBundle,
    uint_image: ProgramBundle,
    int_image: ProgramBundle,
    planar_normalized_image: ProgramBundle,
    planar_uint_image: ProgramBundle,
    planar_int_image: ProgramBundle,
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
) -> Result<BufferInfo> {
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

fn create_placeholder_texture(gl: &GL) -> Result<GLGuard<web_sys::WebGlTexture>> {
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

fn text_color(pixel_color: Vec4, drawing_options: &DrawingOptions) -> Vec4 {
    let multipliers: [f32; 3] = [0.299, 0.587, 0.114];
    let mut gray = multipliers[0] * pixel_color.x
        + multipliers[1] * pixel_color.y
        + multipliers[2] * pixel_color.z;

    if f32::is_nan(gray) {
        // nan is drawn as black
        gray = 0.0;
    }

    let alpha = pixel_color.w;
    let invert = drawing_options.invert;

    if alpha < 0.5 {
        // pixel color is too transparent, draw black to make it readable
        Vec4::new(0.0, 0.0, 0.0, 1.0)
    } else {
        let mut text_color = 1.0 - f32::floor(gray + 0.5);
        if invert {
            text_color = 1.0 - text_color;
        }
        Vec4::new(text_color, text_color, text_color, 1.0)
    }
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

    fn create_programs(gl: &WebGl2RenderingContext) -> Result<Programs> {
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
        let planar_normalized_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image-planar-normalized.frag"))
            .attribute("vin_position")
            .build()?;
        let planar_uint_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image-planar-uint.frag"))
            .attribute("vin_position")
            .build()?;
        let planar_int_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_str!("../shaders/image-planar-int.frag"))
            .attribute("vin_position")
            .build()?;

        Ok(Programs {
            normalized_image,
            uint_image,
            int_image,
            planar_normalized_image,
            planar_uint_image,
            planar_int_image,
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
    ) -> Result<()> {
        Renderer::scissor_view(gl, &image_view_data.html_element);

        // Clean the canvas
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

        let canvas = Renderer::canvas(gl);

        // The following two lines set the size (in CSS pixels) of
        // the drawing buffer to be identical to the size of the
        // canvas HTML element, as determined by CSS.
        canvas.set_width(canvas.client_width() as _);
        canvas.set_height(canvas.client_height() as _);

        if let Some(image_id) = &image_view_data.image_id {
            match rendering_context.texture_by_id(image_id) {
                crate::app_state::images::ImageAvailability::NotAvailable
                | crate::app_state::images::ImageAvailability::Pending => {}
                crate::app_state::images::ImageAvailability::Available(texture) => {
                    Renderer::render_image(
                        rendering_context,
                        rendering_data,
                        texture,
                        image_view_data,
                        view_name,
                    );
                }
            }
        };

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
        let mut _program_name;

        let program = match (
            texture.image.info.data_ordering,
            texture.image.info.channels,
        ) {
            (DataOrdering::HWC, _) | (DataOrdering::CHW, Channels::One) => {
                match texture.image.info.datatype {
                    Datatype::Uint8 | Datatype::Uint16 | Datatype::Uint32 => {
                        _program_name = "uint_image";
                        &rendering_data.programs.uint_image
                    }
                    Datatype::Float32 => {
                        _program_name = "normalized_image";
                        &rendering_data.programs.normalized_image
                    }
                    Datatype::Int8 | Datatype::Int16 | Datatype::Int32 => {
                        _program_name = "int_image";
                        &rendering_data.programs.int_image
                    }
                    Datatype::Bool => {
                        _program_name = "uint_image";
                        &rendering_data.programs.uint_image
                    }
                }
            }

            (DataOrdering::CHW, _) => match texture.image.info.datatype {
                Datatype::Uint8 | Datatype::Uint32 | Datatype::Uint16 => {
                    _program_name = "planar_uint_image";
                    &rendering_data.programs.planar_uint_image
                }
                Datatype::Float32 => {
                    _program_name = "planar_normalized_image";
                    &rendering_data.programs.planar_normalized_image
                }
                Datatype::Int8 | Datatype::Int16 | Datatype::Int32 => {
                    _program_name = "planar_int_image";
                    &rendering_data.programs.planar_int_image
                }
                Datatype::Bool => {
                    _program_name = "planar_uint_image";
                    &rendering_data.programs.planar_uint_image
                }
            },
        };
        let config = rendering_context.rendering_configuration();

        let html_element_size = Size {
            width: image_view_data.html_element.client_width() as f32,
            height: image_view_data.html_element.client_height() as f32,
        };
        let camera = &image_view_data.camera;

        let image_size = texture.image_size();
        let aspect_ratio = image_size.width as f32 / image_size.height as f32;

        let view_projection =
            camera::calculate_view_projection(&html_element_size, &VIEW_SIZE, camera, aspect_ratio);

        let pixels_info =
            calculate_pixels_information(&image_size, &view_projection, &html_element_size);
        let enable_borders =
            pixels_info.image_pixel_size_device > config.minimum_size_to_render_pixel_border as _;
        let image_size = texture.image_size();
        let image_size_vec = Vec2::new(image_size.width, image_size.height);

        let (drawing_options, global_drawing_options) =
            rendering_context.drawing_options(image_view_data.image_id.as_ref().unwrap());
        let coloring_factors = calculate_color_matrix(
            &texture.image.info,
            &texture.image.computed_info,
            &drawing_options,
        );

        let mut uniform_values = HashMap::new();

        uniform_values.extend(HashMap::from([
            ("u_projectionMatrix", UniformValue::Mat3(&view_projection)),
            ("u_enable_borders", UniformValue::Bool(&enable_borders)),
            ("u_buffer_dimension", UniformValue::Vec2(&image_size_vec)),
            (
                "u_normalization_factor",
                UniformValue::Float(&coloring_factors.normalization_factor),
            ),
            (
                "u_color_multiplier",
                UniformValue::Mat4(&coloring_factors.color_multiplier),
            ),
            (
                "u_color_addition",
                UniformValue::Vec4(&coloring_factors.color_addition),
            ),
            ("u_invert", UniformValue::Bool(&drawing_options.invert)),
        ]));

        let get_textures = |batch_index: u32| match texture.textures[&batch_index] {
            TexturesGroup::HWC(ref texture) => {
                HashMap::from([("u_texture", UniformValue::Texture(texture))])
            }
            TexturesGroup::CHW_G { ref gray } => {
                // This one is using the same method as regular HWC, because it's not really a planar texture
                HashMap::from([("u_texture", UniformValue::Texture(gray))])
            }
            TexturesGroup::CHW_GA {
                ref gray,
                ref alpha,
            } => HashMap::from([
                ("u_image_type", UniformValue::Int(&3)),
                ("u_texture_r", UniformValue::Texture(gray)),
                ("u_texture_g", UniformValue::Texture(alpha)),
            ]),
            TexturesGroup::CHW_RGB {
                ref red,
                ref green,
                ref blue,
            } => HashMap::from([
                ("u_image_type", UniformValue::Int(&1)),
                ("u_texture_r", UniformValue::Texture(red)),
                ("u_texture_g", UniformValue::Texture(green)),
                ("u_texture_b", UniformValue::Texture(blue)),
            ]),
            TexturesGroup::CHW_RGBA {
                ref red,
                ref green,
                ref blue,
                ref alpha,
            } => HashMap::from([
                ("u_image_type", UniformValue::Int(&2)),
                ("u_texture_r", UniformValue::Texture(red)),
                ("u_texture_g", UniformValue::Texture(green)),
                ("u_texture_b", UniformValue::Texture(blue)),
                ("u_texture_a", UniformValue::Texture(alpha)),
            ]),
        };

        let (is_batched, batch_index) = drawing_options.as_batch_slice;
        if is_batched {
            uniform_values.extend(get_textures(batch_index));
        } else {
            uniform_values.extend(get_textures(0));
        }

        let uniform_keys_sorted: Vec<_> = uniform_values.keys().sorted().collect();

        let colormap_texture = if Coloring::Heatmap == drawing_options.coloring {
            let color_map_texture = rendering_context
                .get_color_map_texture(&global_drawing_options.heatmap_colormap_name)
                .expect("Could not get color map texture");

            let tex = color_map_texture.obj.clone();
            Some(tex)
        } else if Coloring::Segmentation == drawing_options.coloring {
            let color_map_texture = rendering_context
                .get_color_map_texture(&global_drawing_options.segmentation_colormap_name)
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

                    let offset = if is_batched {
                        calc_num_bytes_per_image(
                            texture.image.info.width,
                            texture.image.info.height,
                            texture.image.info.channels,
                            texture.image.info.datatype,
                        ) * batch_index as usize
                    } else {
                        0
                    };

                    let pixel_value = PixelValue::from_image(&texture.image, &pixel, offset);

                    // The actual pixel color might be different from the pixel value, depending on drawing options
                    let text_color = match drawing_options.coloring {
                        Coloring::Heatmap | Coloring::Segmentation => {
                            let name = match drawing_options.coloring {
                                Coloring::Heatmap => &global_drawing_options.heatmap_colormap_name,
                                Coloring::Segmentation => {
                                    &global_drawing_options.segmentation_colormap_name
                                }
                                _ => unreachable!(),
                            };
                            let colormap = rendering_context
                                .get_color_map(name)
                                .expect("Could not get color map");
                            let pixel_color = coloring::calculate_pixel_color_from_colormap(
                                &pixel_value,
                                &coloring_factors,
                                colormap.as_ref(),
                                &drawing_options,
                            );

                            text_color(pixel_color, &DrawingOptions::default())
                        }
                        _ => {
                            let rgba = Vec4::from(pixel_value.as_rgba_f32());
                            let pixel_color = coloring_factors.color_multiplier
                                * (rgba / coloring_factors.normalization_factor)
                                + coloring_factors.color_addition;

                            text_color(pixel_color, &drawing_options)
                        }
                    };

                    rendering_data.text_renderer.render(PixelTextRenderingData {
                        pixel_text_cache,
                        pixel_loc: &pixel,
                        pixel_value: &pixel_value,
                        image_coords_to_view_coord_mat: &image_pixels_to_view,
                        view_projection: &view_projection,
                        text_color: &text_color,
                    });
                }
            }
        }
    }
}
