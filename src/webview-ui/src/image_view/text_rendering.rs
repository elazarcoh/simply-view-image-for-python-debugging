use std::{collections::HashMap, iter::FromIterator, ops::Deref, rc::Rc};

use glam::{Mat3, Vec4};
use glyph_brush::{
    ab_glyph::FontArc,
    ab_glyph::{Font, Rect},
    GlyphBrush, GlyphBrushBuilder, Rectangle,
};
use web_sys::{WebGl2RenderingContext, WebGlBuffer, WebGlTexture};

use crate::{
    common::Size,
    webgl_utils::{
        self,
        attributes::{create_buffer_info_from_arrays, Arrays},
        draw::draw_buffer_info,
        program::{set_buffers_and_attributes, set_uniforms},
        reusable_buffer::ReusableBuffer,
        *,
    },
};

struct Buffers {
    buffers: BufferInfo<ReusableBuffer>,
}

impl Buffers {
    fn uv_buffer(&mut self) -> &mut ReusableBuffer {
        &mut self.buffers.get_attrib_mut("uv").unwrap().buffer
    }
    fn position_buffer(&mut self) -> &mut ReusableBuffer {
        &mut self.buffers.get_attrib_mut("vin_position").unwrap().buffer
    }
}

pub struct TextRenderer {
    gl: WebGl2RenderingContext,
    glyph_brush: GlyphBrush<SingleGlyphData>,
    program: ProgramBundle,
    texture: GLGuard<WebGlTexture>,
    buffers: Buffers,
}

#[derive(Copy, Clone)]
#[repr(C)]
struct SingleGlyphData {
    positions: [f32; 12],
    tex_coords: [f32; 12],
}

// struct GlyphsArrays {
//     positions: ArraySpec<Vec<f32>>,
//     tex_coords: ArraySpec<Vec<f32>>,
// }

// impl GlyphsArrays {
//     fn from_glyphs(glyphs: &[SingleGlyphData]) -> Self {
//         let size = glyphs.len() * 6 * 2;
//         let mut positions_vec = Vec::with_capacity(size);
//         let mut tex_coords_vec = Vec::with_capacity(size);

//         for glyph in glyphs {
//             positions_vec.extend_from_slice(&glyph.positions);
//             tex_coords_vec.extend_from_slice(&glyph.tex_coords);
//         }

//         log::debug!("Positions: {:?}", positions_vec);
//         log::debug!("Tex coords: {:?}", tex_coords_vec);

//         let positions = ArraySpec {
//             data: positions_vec,
//             num_components: 2,
//             name: "vin_position".to_string(),
//             normalized: false,
//             stride: None,
//             target: BindingPoint::ArrayBuffer,
//         };

//         let tex_coords = ArraySpec {
//             data: tex_coords_vec,
//             num_components: 2,
//             name: "uv".to_string(),
//             normalized: false,
//             stride: None,
//             target: BindingPoint::ArrayBuffer,
//         };

//         Self {
//             positions,
//             tex_coords,
//         }
//     }

//     fn into_buffers(self, gl: &WebGl2RenderingContext) -> Result<BufferInfo, String> {
//         let arrays = Arrays {
//             f32_arrays: vec![self.positions, self.tex_coords],
//             u8_arrays: vec![] as Vec<ArraySpec<Vec<u8>>>,
//         };
//         create_buffer_info_from_arrays(gl, arrays, None)
//     }
// }

fn rect_to_positions(rect: Rect) -> [f32; 12] {
    [
        // Triangle 1
        // TL
        rect.min.x, rect.min.y, // TR
        rect.max.x, rect.min.y, // BL
        rect.min.x, rect.max.y, // Triangle 2
        // BL
        rect.min.x, rect.max.y, // TR
        rect.max.x, rect.min.y, // BR
        rect.max.x, rect.max.y,
    ]
}

impl SingleGlyphData {
    fn from_brush_vertex(vertex: glyph_brush::GlyphVertex) -> Self {
        Self {
            positions: rect_to_positions(vertex.pixel_coords),
            tex_coords: rect_to_positions(vertex.tex_coords),
        }
    }
}

impl TextRenderer {
    fn create_texture(
        gl: &WebGl2RenderingContext,
        size: Size,
    ) -> Result<GLGuard<WebGlTexture>, String> {
        let texture = gl
            .create_texture()
            .ok_or("Could not create texture.".to_string())?;
        gl.bind_texture(TextureTarget::Texture2D as _, Some(&texture));
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            TextureTarget::Texture2D as _,
            0,
            WebGl2RenderingContext::R8 as _,
            size.width as _,
            size.height as _,
            0,
            WebGl2RenderingContext::RED,
            WebGl2RenderingContext::UNSIGNED_BYTE,
            None,
        )
        .map_err(|jsvalue| format!("Could not create texture: {:?}", jsvalue))?;

        gl.pixel_storei(WebGl2RenderingContext::UNPACK_ALIGNMENT, 1);
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            WebGl2RenderingContext::TEXTURE_WRAP_S,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            WebGl2RenderingContext::TEXTURE_WRAP_T,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            WebGl2RenderingContext::TEXTURE_MIN_FILTER,
            WebGl2RenderingContext::NEAREST as i32,
        );
        gl.tex_parameteri(
            TextureTarget::Texture2D as _,
            WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            WebGl2RenderingContext::NEAREST as i32,
        );

        Ok(GLGuard {
            gl: gl.clone(),
            obj: texture,
        })
    }

    pub fn try_new(gl: WebGl2RenderingContext) -> Result<Self, String> {
        let font =
            FontArc::try_from_slice(include_bytes!("../../assets/fonts/ChakraPetch-Regular.ttf"))
                .map_err(|e| e.to_string())?;
        let glyph_brush: GlyphBrush<SingleGlyphData> =
            { GlyphBrushBuilder::using_font(font).build() };
        let texture = Self::create_texture(
            &gl,
            Size::from_width_and_height_u32(glyph_brush.texture_dimensions()),
        )?;

        let text_program = webgl_utils::program::GLProgramBuilder::new(&gl)
            .vertex_shader(include_str!("../shaders/text.vert"))
            .fragment_shader(include_str!("../shaders/text.frag"))
            .attribute("vin_position")
            .build()?;

        let uv_buffer = ReusableBuffer::new(gl.clone(), 1024)?;
        let position_buffer = ReusableBuffer::new(gl.clone(), 1024)?;
        let buffers = BufferInfo::<ReusableBuffer> {
            num_elements: 0,
            attribs: vec![
                Attrib {
                    buffer: uv_buffer,
                    info: AttribInfo {
                        name: "vin_position".to_string(),
                        num_components: 2,
                        gl_type: ElementType::Float,
                        normalized: false,
                        stride: 0,
                    },
                },
                Attrib {
                    buffer: position_buffer,
                    info: AttribInfo {
                        name: "uv".to_string(),
                        num_components: 2,
                        gl_type: ElementType::Float,
                        normalized: false,
                        stride: 0,
                    },
                },
            ],
            indices: None,
        };

        let buffers = Buffers { buffers };

        Ok(Self {
            gl,
            glyph_brush,
            program: text_program,
            texture,
            buffers,
        })
    }

    pub fn queue_section(&mut self, section: glyph_brush::Section) {
        self.glyph_brush.queue(section);
    }

    pub fn render(&mut self, image_coords_to_view_coord_mat: &Mat3, view_projection: &Mat3) {
        let gl = &self.gl;
        let texture = &self.texture;

        let update_texture = move |rect: Rectangle<u32>, tex_data: &[u8]| {
            log::debug!("Updating texture");
            gl.bind_texture(TextureTarget::Texture2D as _, Some(&texture));

            gl.tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_u8_array(
                TextureTarget::Texture2D as _,
                0,
                rect.min[0] as _,
                rect.min[1] as _,
                rect.width() as _,
                rect.height() as _,
                Format::Red as _,
                ElementType::UnsignedByte as _,
                Some(&tex_data),
            )
            .unwrap();
        };

        match self
            .glyph_brush
            .process_queued(update_texture, SingleGlyphData::from_brush_vertex)
        {
            Ok(glyph_brush::BrushAction::Draw(glyphs)) => {
                log::debug!("new text");
                let mut offset = 0;
                let mut num_elements = 0;
                for glyph in &glyphs {
                    self.buffers
                        .uv_buffer()
                        .set_content(&bytemuck::cast_slice(&glyph.tex_coords), offset)
                        .unwrap();
                    self.buffers
                        .position_buffer()
                        .set_content(&bytemuck::cast_slice(&glyph.positions), offset)
                        .unwrap();
                    offset += 12 * std::mem::size_of::<f32>();
                    num_elements += 6;
                }
                self.buffers.buffers.num_elements = num_elements;

                self.draw(image_coords_to_view_coord_mat, view_projection);
            }

            Ok(glyph_brush::BrushAction::ReDraw) => {
                self.draw(image_coords_to_view_coord_mat, view_projection);
            }

            Err(e) => {
                log::error!("Error drawing text: {:?}", e);
            }
        };
    }

    fn draw(&self, image_coords_to_view_coord_mat: &Mat3, view_projection: &Mat3) {
        let gl = &self.gl;
        let program = &self.program;

        gl.use_program(Some(&program.program));
        set_uniforms(
            program,
            &HashMap::from([
                ("u_gylphTexture", UniformValue::Texture(&self.texture)),
                // (
                //     "u_pixelColor",
                //     UniformValue::Vec4(&Vec4::new(1.0, 0.0, 0.0, 1.0)),
                // ),
                (
                    "u_imageToScreenMatrix",
                    UniformValue::Mat3(image_coords_to_view_coord_mat),
                ),
                ("u_projectionMatrix", UniformValue::Mat3(view_projection)),
            ]),
        );
        set_buffers_and_attributes(&self.program, &self.buffers.buffers);
        draw_buffer_info(gl, &self.buffers.buffers, DrawMode::Triangles);
    }
}
