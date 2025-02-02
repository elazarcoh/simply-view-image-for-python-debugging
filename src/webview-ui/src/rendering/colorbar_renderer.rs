use anyhow::Result;
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use web_sys::WebGl2RenderingContext;
use web_sys::{HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL};

use crate::coloring::{Clip, DrawingOptions};
use crate::common::Datatype;
use crate::rendering::utils::gl_canvas;
use crate::webgl_utils::attributes::{create_buffer_info_from_arrays, Arrays};
use crate::webgl_utils::draw::{self, draw_buffer_info};
use crate::webgl_utils::program::{set_buffers_and_attributes, set_uniforms};
use crate::webgl_utils::{
    self, ArraySpec, BindingPoint, BufferInfo, DrawMode, GLGuard, ProgramBundle, UniformValue,
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

fn create_texture(gl: &GL) -> Result<GLGuard<web_sys::WebGlTexture>> {
    // 0-255
    const BYTES: &[u8; 256] = &[
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
        71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93,
        94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
        113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130,
        131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148,
        149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166,
        167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184,
        185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202,
        203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220,
        221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238,
        239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255,
    ];
    webgl_utils::textures::create_texture_from_bytes(
        gl,
        BYTES,
        BYTES.len() as u32,
        1, // height
        1, // channels
        Datatype::Uint8,
        webgl_utils::types::CreateTextureParametersBuilder::default()
            .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
            .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
            .wrap_s(webgl_utils::constants::TextureWrap::ClampToEdge)
            .wrap_t(webgl_utils::constants::TextureWrap::ClampToEdge)
            .build()
            .unwrap(),
    )
}

struct Programs {
    colorbar: ProgramBundle,
}

struct RenderingData {
    gl: GL,
    programs: Programs,

    buffer: BufferInfo,
    texture: GLGuard<web_sys::WebGlTexture>,
}

pub(crate) struct ColorBarRenderer {}

impl ColorBarRenderer {
    pub(crate) fn new() -> Self {
        Self {}
    }

    pub(crate) fn setup_rendering_callback(
        rendering_context: Rc<dyn RenderingContext>,
    ) -> Result<Box<dyn FnMut()>> {
        let gl = rendering_context.gl().clone();

        let programs = Self::create_programs(&gl)?;
        let buffer = create_image_plane_attributes(&gl).unwrap();
        let texture = create_texture(&gl).unwrap();

        let mut rendering_data = RenderingData {
            gl: gl.clone(),
            programs,
            buffer,
            texture,
        };

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
        if let Some(ref data) = rendering_context.get_color_bar_data() {
            Self::render_color_bar(gl, rendering_data, rendering_context, data);
        }
    }

    fn render_color_bar(
        gl: &WebGl2RenderingContext,
        rendering_data: &mut RenderingData,
        rendering_context: &dyn RenderingContext,
        data: &ColorBarData,
    ) {
        scissor_view(gl, &data.html_element);

        // fill
        gl.clear_color(1.0, 1.0, 0.0, 1.0);
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

        let program = &rendering_data.programs.colorbar;

        let color_map_texture = rendering_context
            .get_color_map_texture("fire")
            .expect("Could not get color map texture");

        let colormap_texture: web_sys::WebGlTexture = color_map_texture.obj.clone();

        let mut uniform_values = HashMap::new();

        uniform_values.insert("u_direction", UniformValue::Int(&1));

        uniform_values.insert("u_colormap", UniformValue::Texture(&colormap_texture));

        let drawing_options = DrawingOptions {
            coloring: crate::coloring::Coloring::Heatmap,
            invert: false,
            high_contrast: false,
            ignore_alpha: false,
            batch_item: None,
            clip: Clip {
                min: Some(0.3),
                max: Some(0.8)
            },
        };

        if let Some(ref clip_min) = drawing_options.clip.min {
            uniform_values.insert("u_clip_min", UniformValue::Bool(&true));
            uniform_values.insert("u_min_clip_value", UniformValue::Float(clip_min));
        } else {
            uniform_values.insert("u_clip_min", UniformValue::Bool(&false));
        }
        if let Some(ref clip_max) = drawing_options.clip.max {
            uniform_values.insert("u_clip_max", UniformValue::Bool(&true));
            uniform_values.insert("u_max_clip_value", UniformValue::Float(clip_max));
        } else {
            uniform_values.insert("u_clip_max", UniformValue::Bool(&false));
        }

        // draw color bar
        gl.use_program(Some(&program.program));
        set_uniforms(program, &uniform_values);
        set_buffers_and_attributes(program, &rendering_data.buffer);
        draw_buffer_info(gl, &rendering_data.buffer, DrawMode::Triangles);
    }
}
