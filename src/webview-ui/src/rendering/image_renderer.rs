use anyhow::Ok;
use anyhow::Result;
use std::iter::FromIterator;
use yewdux::mrc::Mrc;

use std::{collections::HashMap, rc::Rc};

use glam::{Mat3, UVec2, Vec2, Vec4};

use web_sys::{WebGl2RenderingContext as GL, WebGl2RenderingContext};

use crate::application_state::app_state::GlobalDrawingOptions;
use crate::application_state::images::DrawingContext;
use crate::application_state::images::ImageAvailability;
use crate::application_state::views::OverlayItem;
use crate::coloring;
use crate::coloring::{calculate_color_matrix, Coloring, DrawingOptions};
use crate::common::camera;
use crate::common::constants::all_views;
use crate::common::pixel_value::PixelValue;
use crate::common::texture_image::TextureImage;
use crate::common::texture_image::TexturesGroup;
use crate::common::Channels;
use crate::common::CurrentlyViewing;
use crate::common::DataOrdering;
use crate::common::Datatype;
use crate::common::Size;
use crate::common::ViewId;
use crate::math_utils::image_calculations::calculate_pixels_information;
use crate::webgl_utils;
use crate::webgl_utils::attributes::{create_buffer_info_from_arrays, Arrays};
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::types::*;

use super::constants::VIEW_SIZE;
use super::rendering_context::{ImageViewData, RenderingContext};
use super::utils::scissor_view;
use crate::rendering::pixel_text_rendering::{
    PixelTextCache, PixelTextRenderer, PixelTextRenderingData,
};

macro_rules! include_shader {
    ($shader_name:expr) => {
        include_str!(concat!(env!("OUT_DIR"), "/shaders/", $shader_name))
    };
}

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

pub(crate) struct ImageRenderer {}

impl ImageRenderer {
    pub(crate) fn setup_rendering_callback(
        rendering_context: Rc<dyn RenderingContext>,
    ) -> Result<Box<dyn FnMut()>> {
        let gl = rendering_context.gl().clone();

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        gl.enable(GL::BLEND);
        gl.blend_func(GL::SRC_ALPHA, GL::ONE_MINUS_SRC_ALPHA);

        gl.enable(GL::DEPTH_TEST);
        gl.depth_mask(false);

        let programs = ImageRenderer::create_programs(&gl).unwrap();

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

        Ok(Box::new(move || {
            ImageRenderer::render(&gl, &mut rendering_data, rendering_context.as_ref());
        }))
    }

    fn create_programs(gl: &WebGl2RenderingContext) -> Result<Programs> {
        let normalized_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_shader!("normalized-image.frag"))
            .attribute("vin_position")
            .build()?;
        let uint_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_shader!("uint-image.frag"))
            .attribute("vin_position")
            .build()?;
        let int_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_shader!("int-image.frag"))
            .attribute("vin_position")
            .build()?;
        let planar_normalized_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_shader!("normalized-planar-image.frag"))
            .attribute("vin_position")
            .build()?;
        let planar_uint_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_shader!("uint-planar-image.frag"))
            .attribute("vin_position")
            .build()?;
        let planar_int_image = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/image.vert"))
            .fragment_shader(include_shader!("int-planar-image.frag"))
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
                ImageRenderer::render_view(
                    gl,
                    rendering_data,
                    &view_data,
                    rendering_context,
                    view_id,
                )
            })
            .collect::<Result<Vec<_>, _>>();

        if let Err(e) = render_result {
            log::error!("Renderer::render: {}", e);
        }
    }

    fn render_view(
        gl: &WebGl2RenderingContext,
        rendering_data: &mut RenderingData,
        image_view_data: &ImageViewData,
        rendering_context: &dyn RenderingContext,
        view_name: &ViewId,
    ) -> Result<()> {
        scissor_view(gl, &image_view_data.html_element);

        if let Some(cv) = &image_view_data.currently_viewing {
            let image_id = cv.id();
            match rendering_context.texture_by_id(image_id) {
                ImageAvailability::NotAvailable | ImageAvailability::Pending(_) => {}
                ImageAvailability::Available(texture) => {
                    // for batch, we need to check if the batch item is available
                    let batch_index = if matches!(cv, CurrentlyViewing::BatchItem(_)) {
                        let batch_index = rendering_context
                            .drawing_options(image_id, &DrawingContext::BaseImage)
                            .0
                            .batch_item
                            .filter(|i| texture.borrow().textures.contains_key(i));
                        if batch_index.is_none() {
                            return Ok(());
                        }
                        batch_index
                    } else {
                        None
                    };

                    ImageRenderer::render_image(
                        rendering_context,
                        rendering_data,
                        texture,
                        batch_index,
                        image_view_data,
                        view_name,
                    );
                }
            }
        };

        Ok(())
    }

    fn program_for_texture<'p>(
        texture: &TextureImage,
        programs: &'p Programs,
    ) -> &'p ProgramBundle {
        let texture_info = &texture.info;
        match (texture_info.data_ordering, texture_info.channels) {
            (DataOrdering::HWC, _) | (DataOrdering::CHW, Channels::One) => {
                match texture_info.datatype {
                    Datatype::Uint8 | Datatype::Uint16 | Datatype::Uint32 => &programs.uint_image,
                    Datatype::Float32 => &programs.normalized_image,
                    Datatype::Int8 | Datatype::Int16 | Datatype::Int32 => &programs.int_image,
                    Datatype::Bool => &programs.uint_image,
                }
            }

            (DataOrdering::CHW, _) => match texture_info.datatype {
                Datatype::Uint8 | Datatype::Uint32 | Datatype::Uint16 => {
                    &programs.planar_uint_image
                }
                Datatype::Float32 => &programs.planar_normalized_image,
                Datatype::Int8 | Datatype::Int16 | Datatype::Int32 => &programs.planar_int_image,
                Datatype::Bool => &programs.planar_uint_image,
            },
        }
    }

    fn get_texture_uniforms(
        texture: &'_ TextureImage,
        batch_index: u32,
    ) -> HashMap<&'static str, UniformValue<'_>> {
        match texture.textures[&batch_index] {
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
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn prepare_texture_uniforms<'a>(
        rendering_context: &dyn RenderingContext,
        rendering_data: &'a RenderingData,
        texture: &'a TextureImage,
        colormap_texture: Option<&'a web_sys::WebGlTexture>,
        batch_item: Option<u32>,
        image_view_data: &ImageViewData,
        drawing_context: &DrawingContext,
        uniform_values: &mut HashMap<&'static str, UniformValue<'a>>,
    ) {
        let texture_info = &texture.info;
        let config = rendering_context.rendering_configuration();

        let html_element_size = Size {
            width: image_view_data.html_element.client_width() as f32,
            height: image_view_data.html_element.client_height() as f32,
        };
        let camera = &image_view_data.camera;

        let image_size = texture.image_size();
        let aspect_ratio = image_size.width / image_size.height;

        let view_projection =
            camera::calculate_view_projection(&html_element_size, &VIEW_SIZE, camera, aspect_ratio);

        let pixels_info =
            calculate_pixels_information(&image_size, &view_projection, &html_element_size);
        let enable_borders =
            pixels_info.image_pixel_size_device > config.minimum_size_to_render_pixel_border as _;
        let image_size = texture.image_size();
        let image_size_vec = Vec2::new(image_size.width, image_size.height);

        let image_id = &texture.info.image_id;
        let (drawing_options, _) = rendering_context.drawing_options(image_id, drawing_context);
        let coloring_factors =
            calculate_color_matrix(texture_info, &texture.computed_info, &drawing_options);

        uniform_values.extend(HashMap::from([
            ("u_projectionMatrix", UniformValue::Mat3_(view_projection)),
            ("u_enable_borders", UniformValue::Bool_(enable_borders)),
            ("u_buffer_dimension", UniformValue::Vec2_(image_size_vec)),
            (
                "u_normalization_factor",
                UniformValue::Float_(coloring_factors.normalization_factor),
            ),
            (
                "u_color_multiplier",
                UniformValue::Mat4_(coloring_factors.color_multiplier),
            ),
            (
                "u_color_addition",
                UniformValue::Vec4_(coloring_factors.color_addition),
            ),
            ("u_invert", UniformValue::Bool_(drawing_options.invert)),
        ]));

        let is_batched = batch_item.is_some();
        let batch_index = batch_item.unwrap_or(0);
        uniform_values.extend(ImageRenderer::get_texture_uniforms(texture, batch_index));

        uniform_values.insert(
            "u_edges_only",
            UniformValue::Bool_(drawing_options.coloring == Coloring::Edges),
        );

        if let Some(colormap_texture) = colormap_texture {
            uniform_values.insert("u_colormap", UniformValue::Texture(colormap_texture));
            uniform_values.insert("u_use_colormap", UniformValue::Bool(&true));
        } else {
            uniform_values.insert("u_use_colormap", UniformValue::Bool(&false));
            uniform_values.insert(
                "u_colormap",
                UniformValue::Texture(&rendering_data.placeholder_texture),
            );
        }

        if texture_info.channels == Channels::One {
            if let Some(clip_min) = drawing_options.clip.min {
                uniform_values.insert("u_clip_min", UniformValue::Bool(&true));
                uniform_values.insert("u_min_clip_value", UniformValue::Float_(clip_min));
            } else {
                uniform_values.insert("u_clip_min", UniformValue::Bool(&false));
            }
            if let Some(clip_max) = drawing_options.clip.max {
                uniform_values.insert("u_clip_max", UniformValue::Bool(&true));
                uniform_values.insert("u_max_clip_value", UniformValue::Float_(clip_max));
            } else {
                uniform_values.insert("u_clip_max", UniformValue::Bool(&false));
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn render_text(
        rendering_context: &dyn RenderingContext,
        rendering_data: &mut RenderingData,
        texture: &TextureImage,
        drawing_options: &DrawingOptions,
        global_drawing_options: &GlobalDrawingOptions,
        batch_item: Option<u32>,
        image_view_data: &ImageViewData,
        view_name: &ViewId,
    ) {
        let texture_info = &texture.info;
        let html_element_size = Size {
            width: image_view_data.html_element.client_width() as f32,
            height: image_view_data.html_element.client_height() as f32,
        };
        let camera = &image_view_data.camera;

        let image_size = texture.image_size();
        let aspect_ratio = image_size.width / image_size.height;

        let view_projection =
            camera::calculate_view_projection(&html_element_size, &VIEW_SIZE, camera, aspect_ratio);

        let pixels_info =
            calculate_pixels_information(&image_size, &view_projection, &html_element_size);

        let coloring_factors =
            calculate_color_matrix(texture_info, &texture.computed_info, drawing_options);

        let is_batched = batch_item.is_some();
        let batch_index = batch_item.unwrap_or(0);

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

                let batch_index = if is_batched { batch_index } else { 0 };

                let pixel_value = PixelValue::from_image_info(
                    &texture.info,
                    &texture.bytes[&batch_index],
                    &pixel,
                );

                // The actual pixel color might be different from the pixel value, depending on drawing options
                let text_color = match drawing_options.coloring {
                    Coloring::Edges => {
                        // for edges, the background color is always black
                        text_color(Vec4::new(0.0, 0.0, 0.0, 1.0), drawing_options)
                    },
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
                            drawing_options,
                        );

                        text_color(pixel_color, &DrawingOptions::default())
                    }
                    _ => {
                        let rgba = Vec4::from(pixel_value.as_rgba_f32());
                        let pixel_color = coloring_factors.color_multiplier
                            * (rgba / coloring_factors.normalization_factor)
                            + coloring_factors.color_addition;

                        text_color(pixel_color, drawing_options)
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

    fn render_overlay(
        rendering_context: &dyn RenderingContext,
        rendering_data: &mut RenderingData,
        texture: &TextureImage,
        overlay_item: &OverlayItem,
        batch_item: Option<u32>,
        image_view_data: &ImageViewData,
        view_name: &ViewId,
    ) {
        let gl = &rendering_data.gl;
        let program = ImageRenderer::program_for_texture(texture, &rendering_data.programs);

        let config = rendering_context.rendering_configuration();

        let (drawing_options, global_drawing_options) =
            rendering_context.drawing_options(&overlay_item.id, &DrawingContext::Overlay);

        // log::debug!(
        //     "Rendering overlay {:?} with drawing options: {:?}",
        //     overlay_item,
        //     drawing_options
        // );

        let colormap_texture = if Coloring::Heatmap == drawing_options.coloring {
            let color_map_texture = rendering_context
                .get_color_map_texture(&global_drawing_options.heatmap_colormap_name)
                .expect("Could not get color map texture");

            Some(color_map_texture.obj.clone())
        } else if matches!(
            drawing_options.coloring,
            Coloring::Segmentation | Coloring::Edges
        ) {
            let color_map_texture = rendering_context
                .get_color_map_texture(&global_drawing_options.segmentation_colormap_name)
                .expect("Could not get color map texture");

            Some(color_map_texture.obj.clone())
        } else {
            None
        };

        let mut uniform_values = HashMap::new();

        ImageRenderer::prepare_texture_uniforms(
            rendering_context,
            rendering_data,
            texture,
            colormap_texture.as_ref(),
            batch_item,
            image_view_data,
            &DrawingContext::Overlay,
            &mut uniform_values,
        );

        // Overlay specific uniforms
        uniform_values.insert("u_is_overlay", UniformValue::Bool(&true));
        uniform_values.insert("u_overlay_alpha", UniformValue::Float(&overlay_item.alpha));
        uniform_values.insert(
            "u_zeros_as_transparent",
            UniformValue::Bool(&drawing_options.zeros_as_transparent),
        );

        gl.use_program(Some(&program.program));
        set_uniforms(program, &uniform_values);
        set_buffers_and_attributes(program, &rendering_data.image_plane_buffer);
        draw_buffer_info(gl, &rendering_data.image_plane_buffer, DrawMode::Triangles);
    }

    fn render_overlays(
        rendering_context: &dyn RenderingContext,
        rendering_data: &mut RenderingData,
        batch_item: Option<u32>,
        image_view_data: &ImageViewData,
        view_name: &ViewId,
    ) {
        if let Some(overlay) = &image_view_data
            .overlay
            .as_ref()
            .and_then(|o| (!o.hidden && o.alpha > 0.0).then_some(o))
        {
            let texture = rendering_context.texture_by_id(&overlay.id);
            // log::debug!("Rendering overlay {:?}", overlay);
            if let ImageAvailability::Available(texture) = texture {
                let texture = texture.borrow();
                ImageRenderer::render_overlay(
                    rendering_context,
                    rendering_data,
                    &texture,
                    overlay,
                    batch_item,
                    image_view_data,
                    view_name,
                );
            }
        }
    }

    fn render_image(
        rendering_context: &dyn RenderingContext,
        rendering_data: &mut RenderingData,
        texture: Mrc<TextureImage>,
        batch_item: Option<u32>,
        image_view_data: &ImageViewData,
        view_name: &ViewId,
    ) {
        let texture = texture.borrow();

        let gl = &rendering_data.gl;
        let program = ImageRenderer::program_for_texture(&texture, &rendering_data.programs);
        let config = rendering_context.rendering_configuration();

        let cv_id = image_view_data
            .currently_viewing
            .as_ref()
            .map(CurrentlyViewing::id)
            .unwrap_or_else(|| {
                panic!("No currently viewing for image view data");
            });
        let (drawing_options, global_drawing_options) =
            rendering_context.drawing_options(cv_id, &DrawingContext::BaseImage);

        let colormap_texture = if Coloring::Heatmap == drawing_options.coloring {
            let color_map_texture = rendering_context
                .get_color_map_texture(&global_drawing_options.heatmap_colormap_name)
                .expect("Could not get color map texture");

            let tex = color_map_texture.obj.clone();
            Some(tex)
        } else if matches!(
            drawing_options.coloring,
            Coloring::Segmentation | Coloring::Edges
        ) {
            let color_map_texture = rendering_context
                .get_color_map_texture(&global_drawing_options.segmentation_colormap_name)
                .expect("Could not get color map texture");

            let tex = color_map_texture.obj.clone();
            Some(tex)
        } else {
            None
        };

        let mut uniform_values = HashMap::new();

        ImageRenderer::prepare_texture_uniforms(
            rendering_context,
            rendering_data,
            &texture,
            colormap_texture.as_ref(),
            batch_item,
            image_view_data,
            &DrawingContext::BaseImage,
            &mut uniform_values,
        );

        // Set the overlay specific uniforms
        uniform_values.insert("u_is_overlay", UniformValue::Bool(&false));
        uniform_values.insert("u_overlay_alpha", UniformValue::Float(&0.0));
        uniform_values.insert(
            "u_zeros_as_transparent",
            UniformValue::Bool(&drawing_options.zeros_as_transparent),
        );

        gl.use_program(Some(&program.program));
        set_uniforms(program, &uniform_values);
        set_buffers_and_attributes(program, &rendering_data.image_plane_buffer);
        draw_buffer_info(gl, &rendering_data.image_plane_buffer, DrawMode::Triangles);

        ImageRenderer::render_overlays(
            rendering_context,
            rendering_data,
            batch_item,
            image_view_data,
            view_name,
        );

        let to_render_text = {
            let html_element_size = Size {
                width: image_view_data.html_element.client_width() as f32,
                height: image_view_data.html_element.client_height() as f32,
            };
            let camera = &image_view_data.camera;
            let image_size = texture.image_size();
            let aspect_ratio = image_size.width / image_size.height;
            let view_projection = camera::calculate_view_projection(
                &html_element_size,
                &VIEW_SIZE,
                camera,
                aspect_ratio,
            );
            let pixels_info =
                calculate_pixels_information(&image_size, &view_projection, &html_element_size);

            pixels_info.image_pixel_size_device > config.minimum_size_to_render_pixel_values as _
        };

        if to_render_text {
            ImageRenderer::render_text(
                rendering_context,
                rendering_data,
                &texture,
                &drawing_options,
                &global_drawing_options,
                batch_item,
                image_view_data,
                view_name,
            );
        }
    }
}
