use anyhow::Result;
use std::collections::HashMap;
use std::rc::Rc;
use web_sys::WebGl2RenderingContext;
use web_sys::WebGl2RenderingContext as GL;

use crate::coloring::{calculate_color_matrix, Clip, DrawingOptions};
use crate::webgl_utils::attributes::{create_buffer_info_from_arrays, Arrays};
use crate::webgl_utils::draw::draw_buffer_info;
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::{
    self, ArraySpec, BindingPoint, BufferInfo, DrawMode, ProgramBundle, UniformValue,
};

use super::rendering_context::{ColorBarData, RenderingContext};
use super::utils::scissor_view;

fn create_image_plane_attributes(gl: &GL) -> Result<BufferInfo> {
    #[rustfmt::skip]
    let a_image_plane_position = ArraySpec {
        name: "vin_position".to_string(),
        data: (&[
            -1.0_f32, -1.0, // bottom left
            -1.0, 1.0, // bottom right
            1.0, -1.0, // top left
            1.0, 1.0, // top right
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

struct Programs {
    colorbar: ProgramBundle,
}

struct RenderingData {
    programs: Programs,
    buffer: BufferInfo,
}

pub(crate) struct ColorBarRenderer {}

impl ColorBarRenderer {
    pub(crate) fn setup_rendering_callback(
        rendering_context: Rc<dyn RenderingContext>,
    ) -> Result<Box<dyn FnMut()>> {
        let gl = rendering_context.gl().clone();

        let programs = Self::create_programs(&gl)?;
        let buffer = create_image_plane_attributes(&gl).unwrap();

        let mut rendering_data = RenderingData { programs, buffer };

        Ok(Box::new(move || {
            ColorBarRenderer::render(&gl, &mut rendering_data, rendering_context.as_ref());
        }))
    }

    fn create_programs(gl: &WebGl2RenderingContext) -> Result<Programs> {
        let colorbar = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/colorbar.vert"))
            .fragment_shader(include_str!("../shaders/colorbar.frag"))
            .attribute("vin_position")
            .build()?;
        Ok(Programs { colorbar })
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
                if let Some(ref data) = rendering_context.get_colorbar_data(*view_id) {
                    Self::render_color_bar(gl, rendering_data, rendering_context, data)
                } else {
                    Ok(())
                }
            })
            .collect::<Result<Vec<_>, _>>();

        if let Err(e) = render_result {
            log::error!("Renderer::render: {}", e);
        }
    }

    fn render_color_bar(
        gl: &WebGl2RenderingContext,
        rendering_data: &mut RenderingData,
        rendering_context: &dyn RenderingContext,
        data: &ColorBarData,
    ) -> Result<()> {
        scissor_view(gl, &data.html_element);

        // fill
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

        let program = &rendering_data.programs.colorbar;

        let clip = &data.drawing_options.clip;
        let texture_image = &data.texture_image.borrow();
        let coloring_factors = calculate_color_matrix(
            &texture_image.info,
            &texture_image.computed_info,
            &DrawingOptions {
                // We don't want to calculate the color matrix with the clip applied,
                // since we calculate the clipping values separately.
                clip: Clip::default(),
                ..data.drawing_options
            },
        );
        let min_value_normalized = {
            let mut min = texture_image.computed_info.min.as_rgba_f32()[0];
            if let Some(clip_min) = clip.min {
                min = clip_min;
            }
            coloring_factors.color_multiplier.x_axis.x
                * (min / coloring_factors.normalization_factor)
                + coloring_factors.color_addition.x
        };
        let max_value_normalized = {
            let mut max = texture_image.computed_info.max.as_rgba_f32()[0];
            if let Some(clip_max) = clip.max {
                max = clip_max;
            }
            coloring_factors.color_multiplier.x_axis.x
                * (max / coloring_factors.normalization_factor)
                + coloring_factors.color_addition.x
        };
        log::debug!(
            "ColorBarRenderer::render_color_bar: min_value_normalized: {}, max_value_normalized: {}",
            min_value_normalized,
            max_value_normalized
        );

        let colormap_name = &data.global_drawing_options.heatmap_colormap_name;

        let colormap_texture: web_sys::WebGlTexture = rendering_context
            .get_color_map_texture(colormap_name)
            .expect("Could not get color map texture")
            .obj
            .clone();

        let mut uniform_values = HashMap::new();

        uniform_values.insert("u_direction", UniformValue::Int(&1));

        uniform_values.insert("u_colormap", UniformValue::Texture(&colormap_texture));

        if clip.min.is_some() {
            uniform_values.insert("u_clip_min", UniformValue::Bool(&true));
            uniform_values.insert(
                "u_min_clip_value",
                UniformValue::Float(&min_value_normalized),
            );
        } else {
            uniform_values.insert("u_clip_min", UniformValue::Bool(&false));
        }
        if clip.max.is_some() {
            uniform_values.insert("u_clip_max", UniformValue::Bool(&true));
            uniform_values.insert(
                "u_max_clip_value",
                UniformValue::Float(&max_value_normalized),
            );
        } else {
            uniform_values.insert("u_clip_max", UniformValue::Bool(&false));
        }

        // draw color bar
        gl.use_program(Some(&program.program));
        set_uniforms(program, &uniform_values);
        set_buffers_and_attributes(program, &rendering_data.buffer);
        draw_buffer_info(gl, &rendering_data.buffer, DrawMode::Triangles);

        Ok(())
    }
}
