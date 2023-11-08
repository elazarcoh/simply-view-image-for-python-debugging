use std::{collections::HashMap, fmt::format};

use ab_glyph::{FontArc, Glyph, GlyphId, PxScale, Rect};
use glam::{Mat3, UVec2, Vec4};

use glyph_brush_draw_cache::{DrawCache, Rectangle};
use glyph_brush_layout::{GlyphPositioner, Layout, SectionGeometry, SectionText};
use image::DynamicImage;
use web_sys::{WebGl2RenderingContext, WebGlTexture};

use crate::{
    common::Size,
    communication::incoming_messages::{Channels, Datatype, ImageData},
    webgl_utils::{
        self,
        draw::draw_buffer_info,
        program::{set_buffers_and_attributes, set_uniforms},
        reusable_buffer::ReusableBuffer,
        *,
    },
};

use super::types::PixelValue;

pub struct PixelTextRenderer {
    gl: WebGl2RenderingContext,
    font: FontArc,
    glyph_texture: GlyphTexture,
    program: ProgramBundle,
}

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

#[rustfmt::skip]
fn format_pixel_value(pixel_value: &PixelValue) -> String {
    let bytes_per_element = pixel_value.datatype.num_bytes();
    (0..pixel_value.num_channels.into())
        .map(|c| {
            let start = c as usize * bytes_per_element;
            let end = start + bytes_per_element;
            let bytes = &pixel_value.bytes[start..end];
            match pixel_value.datatype {
                Datatype::Uint8 => format!("{}", u8::from_ne_bytes([bytes[0]])),
                Datatype::Int8 => format!("{}", i8::from_ne_bytes([bytes[0]])),
                Datatype::Float32 => {
                    let value = f32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                    format!("{:.7}", float_pretty_print::PrettyPrintFloat(value as f64))
                }
                Datatype::Bool => format!("{}", (bytes[0] != 0) as u8),
                Datatype::Uint16 => format!("{}", u16::from_ne_bytes([bytes[0], bytes[1]])),
                Datatype::Uint32 => format!("{}", u32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
                Datatype::Int16 => format!("{}", i16::from_ne_bytes([bytes[0], bytes[1]])),
                Datatype::Int32 => format!("{}", i32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn text_color(pixel_value: &PixelValue, invert: bool, ignoring_alpha: bool) -> Vec4 {
    let multipliers: [f32; 3] = match pixel_value.num_channels {
        Channels::One => [1.0, 0.0, 0.0],
        Channels::Two => [0.51, 0.49, 0.0],
        Channels::Three | Channels::Four => [0.299, 0.587, 0.114],
    };
    let mut gray = 0.0;
    let bytes_per_element = pixel_value.datatype.num_bytes();
    let cs = usize::min(pixel_value.num_channels as usize, 3);
    #[rustfmt::skip]
    (0..cs).for_each(|c| {
        let start = c * bytes_per_element;
        let end = start + bytes_per_element;
        let bytes = &pixel_value.bytes[start..end];
        match pixel_value.datatype {
            Datatype::Uint8 => gray += multipliers[c] * u8::from_ne_bytes([bytes[0]]) as f32 / u8::MAX as f32,
            Datatype::Int8 => gray += multipliers[c] * i8::from_ne_bytes([bytes[0]]) as f32 / i8::MAX as f32,
            Datatype::Float32 =>  gray += multipliers[c] * f32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
            Datatype::Bool => gray += (bytes[0] != 0) as u8 as f32,
            Datatype::Uint16 => gray += multipliers[c] * u16::from_ne_bytes([bytes[0], bytes[1]]) as f32 / u16::MAX as f32,
            Datatype::Uint32 => gray += multipliers[c] * u32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32 / u32::MAX as f32,
            Datatype::Int16 => gray += multipliers[c] * i16::from_ne_bytes([bytes[0], bytes[1]]) as f32 / i16::MAX as f32,
            Datatype::Int32 => gray += multipliers[c] * i32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32 / i32::MAX as f32,
        }
    });

    #[rustfmt::skip]
    let alpha = if pixel_value.num_channels < Channels::Four || ignoring_alpha {
        1.0
    } else {
        let start = 3 * bytes_per_element;
        let end = start + bytes_per_element;
        let bytes = &pixel_value.bytes[start..end];
        match pixel_value.datatype {
            Datatype::Uint8 => u8::from_ne_bytes([bytes[0]]) as f32 / u8::MAX as f32,
            Datatype::Int8 => i8::from_ne_bytes([bytes[0]]) as f32 / i8::MAX as f32,
            Datatype::Float32 => f32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
            Datatype::Bool => (bytes[0] != 0) as u8 as f32,
            Datatype::Uint16 => u16::from_ne_bytes([bytes[0], bytes[1]]) as f32 / u16::MAX as f32,
            Datatype::Uint32 => u32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32 / u32::MAX as f32,
            Datatype::Int16 => i16::from_ne_bytes([bytes[0], bytes[1]]) as f32 / i16::MAX as f32,
            Datatype::Int32 => i32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32 / i32::MAX as f32,
        }
    };

    if f32::is_nan(gray) {  // nan is drawn as black
        gray = 0.0;
    } 

    if alpha < 0.5 {
        Vec4::new(0.0, 0.0, 0.0, 1.0)
    } else {
        let mut text_color = 1.0 - f32::floor(gray + 0.5);
        if invert {
            text_color = 1.0 - text_color;
        }
        Vec4::new(text_color, text_color, text_color, 1.0)
    }
}

struct PixelTextData {
    buffer_info: BufferInfo<ReusableBuffer>,
    pixel_value: PixelValue,
}

fn calculate_text_to_image(font_scale: f32, max_rows_cols: f32) -> Mat3 {
    Mat3::from_scale(glam::Vec2::new(
        (1.0 / max_rows_cols) / (font_scale),
        (1.0 / max_rows_cols) / (font_scale),
    ))
}

impl PixelTextData {
    fn try_new(gl: &WebGl2RenderingContext, pixel_value: &PixelValue) -> Result<Self, String> {
        let buffer_info = BufferInfo {
            num_elements: 6,
            attribs: vec![
                Attrib {
                    buffer: Self::create_buffer_for_pixel(gl)?,
                    info: AttribInfo {
                        name: "vin_position".to_string(),
                        num_components: 2,
                        gl_type: ElementType::Float,
                        normalized: false,
                        stride: 0,
                    },
                },
                Attrib {
                    buffer: Self::create_buffer_for_pixel(gl)?,
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

        Ok(Self {
            buffer_info,
            pixel_value: *pixel_value,
        })
    }

    fn create_buffer_for_pixel(gl: &WebGl2RenderingContext) -> Result<ReusableBuffer, String> {
        ReusableBuffer::new(gl.clone(), 1024)
    }

    fn uv_buffer(&mut self) -> &mut ReusableBuffer {
        &mut self.buffer_info.get_attrib_mut("uv").unwrap().buffer
    }

    fn position_buffer(&mut self) -> &mut ReusableBuffer {
        &mut self
            .buffer_info
            .get_attrib_mut("vin_position")
            .unwrap()
            .buffer
    }
}

struct GlyphTexture {
    gl: WebGl2RenderingContext,
    texture: GLGuard<WebGlTexture>,
    glyphs: HashMap<GlyphId, (char, Glyph)>,
    draw_cache: DrawCache,
}

impl GlyphTexture {
    fn try_new(gl: WebGl2RenderingContext) -> Result<Self, String> {
        let draw_cache = DrawCache::builder().build();
        let glyphs = HashMap::new();
        let texture = Self::create_texture(
            &gl,
            Size::from_width_and_height_u32(draw_cache.dimensions()),
        )?;
        Ok(Self {
            gl,
            texture,
            glyphs,
            draw_cache,
        })
    }

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

    fn prepare_glyphs(&mut self, font: &FontArc) {
        let scale = 100.0;
        let required_letters = "0123456789., -+enNaif";
        let glyphs = Layout::default().calculate_glyphs(
            &[&font],
            &SectionGeometry {
                ..SectionGeometry::default()
            },
            &[SectionText {
                text: required_letters,
                scale: PxScale::from(scale),
                font_id: glyph_brush_layout::FontId(0),
            }],
        );
        required_letters
            .chars()
            .zip(glyphs.iter())
            .for_each(|(c, glyph)| {
                self.glyphs.insert(glyph.glyph.id, (c, glyph.glyph.clone()));
            });

        for glyph in glyphs {
            // log::debug!("Adding glyph to draw cache: {:?}", glyph.glyph);
            self.draw_cache.queue_glyph(0, glyph.glyph.clone());
        }

        let texture = &self.texture;
        let gl = &self.gl;
        let update_texture = |rect: Rectangle<u32>, tex_data: &[u8]| {
            // log::debug!("Updating texture");
            gl.bind_texture(TextureTarget::Texture2D as _, Some(texture));

            gl.tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_u8_array(
                TextureTarget::Texture2D as _,
                0,
                rect.min[0] as _,
                rect.min[1] as _,
                rect.width() as _,
                rect.height() as _,
                Format::Red as _,
                ElementType::UnsignedByte as _,
                Some(tex_data),
            )
            .unwrap();
        };
        self.draw_cache
            .cache_queued(&[&font], update_texture)
            .unwrap();
    }

    fn glyph_uv(&self, section_glyph: &glyph_brush_layout::SectionGlyph) -> Option<(Rect, Rect)> {
        self.glyphs
            .get(&section_glyph.glyph.id)
            .and_then(|(_, glyph)| {
                let diff = section_glyph.glyph.position - glyph.position;
                self.draw_cache
                    .rect_for(
                        0,
                        &Glyph {
                            position: glyph.position,
                            ..glyph.clone()
                        },
                    )
                    .map(|rect| {
                        let uv = rect.0;
                        let bbox = rect.1;
                        let bbox = Rect {
                            min: bbox.min + diff,
                            max: bbox.max + diff,
                        };
                        (uv, bbox)
                    })
            })
    }
}

pub(super) struct PixelTextCache(HashMap<UVec2, PixelTextData>);

pub(super) struct PixelTextRenderingData<'a> {
    pub pixel_text_cache: &'a mut PixelTextCache,
    pub pixel_loc: &'a UVec2,
    pub pixel_value: &'a PixelValue,
    pub image_coords_to_view_coord_mat: &'a Mat3,
    pub view_projection: &'a Mat3,
    // data from DrawingOptions
    pub invert: bool,
    pub ignoring_alpha: bool,
}

impl PixelTextRenderer {
    pub fn try_new(gl: &WebGl2RenderingContext) -> Result<Self, String> {
        let font =
            FontArc::try_from_slice(include_bytes!("../../assets/fonts/ChakraPetch-Regular.ttf"))
                .map_err(|e| e.to_string())?;

        let text_program = webgl_utils::program::GLProgramBuilder::create(gl)
            .vertex_shader(include_str!("../shaders/text.vert"))
            .fragment_shader(include_str!("../shaders/text.frag"))
            .attribute("vin_position")
            .build()?;

        let mut glyph_texture = GlyphTexture::try_new(gl.clone())?;
        glyph_texture.prepare_glyphs(&font);

        Ok(Self {
            gl: gl.clone(),
            font,
            glyph_texture,
            program: text_program,
        })
    }

    fn pixel_value_into_buffers(
        pixel_loc: &UVec2,
        pixel_value: &PixelValue,
        glyph_texture: &GlyphTexture,
        font: &FontArc,
        pixel_data: &mut PixelTextData,
    ) {
        let x = pixel_loc.x;
        let y = pixel_loc.y;
        let font_scale = 100.0;
        let max_rows = 3_f32;
        let max_cols = 5_f32;
        let max_rows_cols = f32::max(max_rows, max_cols);
        let letters_offset_inside_pixel = max_rows_cols / 2.0;
        let pixel_offset = max_rows_cols;
        let px = 0.0;
        let py = 0.0;

        let pixel_text = format_pixel_value(pixel_value);
        log::debug!("Pixel text: {}", pixel_text);

        let glyphs = Layout::default()
            .v_align(glyph_brush_layout::VerticalAlign::Center)
            .h_align(glyph_brush_layout::HorizontalAlign::Center)
            .calculate_glyphs(
                &[font],
                &SectionGeometry {
                    screen_position: (
                        ((x as f32 + px) * pixel_offset + letters_offset_inside_pixel) * font_scale,
                        ((y as f32 + py) * pixel_offset + letters_offset_inside_pixel) * font_scale,
                    ),
                    ..SectionGeometry::default()
                },
                &[SectionText {
                    text: &pixel_text,
                    scale: PxScale::from(font_scale),
                    font_id: glyph_brush_layout::FontId(0),
                }],
            );
        // log::debug!("Glyphs: {:?}", glyphs);
        let (uvs, bboxes): (Vec<_>, Vec<_>) = glyphs
            .iter()
            .filter_map(|glyph| glyph_texture.glyph_uv(glyph))
            .unzip();
        let num_rendered_glyphs = uvs.len();
        let uvs = uvs
            .iter()
            .flat_map(|rect| rect_to_positions(*rect))
            .collect::<Vec<_>>();
        let bbox = bboxes
            .iter()
            .flat_map(|rect| rect_to_positions(*rect))
            .collect::<Vec<_>>();

        // log::debug!("UVs: {:?}", uvs);
        // log::debug!("BBox: {:?}", bbox);

        pixel_data
            .uv_buffer()
            .set_content(bytemuck::cast_slice(&uvs), 0)
            .unwrap();
        pixel_data
            .position_buffer()
            .set_content(bytemuck::cast_slice(&bbox), 0)
            .unwrap();
        pixel_data.buffer_info.num_elements = 6 * num_rendered_glyphs;
    }

    fn get_cache_pixel<'a>(
        &self,
        data: PixelTextRenderingData<'a>,
    ) -> Result<&'a PixelTextData, String> {
        if let Some(pixel_data) = data.pixel_text_cache.0.get_mut(data.pixel_loc) {
            if pixel_data.pixel_value != *data.pixel_value {
                Self::pixel_value_into_buffers(
                    data.pixel_loc,
                    data.pixel_value,
                    &self.glyph_texture,
                    &self.font,
                    pixel_data,
                );

                pixel_data.pixel_value = *data.pixel_value;
            }
        } else {
            // log::debug!("Creating new pixel text cache");
            let mut pixel_data = PixelTextData::try_new(&self.gl, data.pixel_value)?;
            Self::pixel_value_into_buffers(
                data.pixel_loc,
                data.pixel_value,
                &self.glyph_texture,
                &self.font,
                &mut pixel_data,
            );

            data.pixel_text_cache.0.insert(*data.pixel_loc, pixel_data);
        }
        Ok(data.pixel_text_cache.0.get(data.pixel_loc).unwrap())
    }

    pub(super) fn make_pixel_text_cache(&self) -> PixelTextCache {
        PixelTextCache(HashMap::new())
    }

    pub(super) fn render(&self, data: PixelTextRenderingData) {
        let gl = &self.gl;
        let program = &self.program;

        let font_scale = 100.0;
        let max_row_cols = 5;
        let text_to_image = calculate_text_to_image(font_scale, max_row_cols as _);

        gl.use_program(Some(&program.program));
        set_uniforms(
            program,
            &HashMap::from([
                (
                    "u_gylphTexture",
                    UniformValue::Texture(&self.glyph_texture.texture),
                ),
                (
                    "u_textColor",
                    UniformValue::Vec4(&text_color(
                        data.pixel_value,
                        data.invert,
                        data.ignoring_alpha,
                    )),
                ),
                (
                    "u_imageToScreenMatrix",
                    UniformValue::Mat3(&(*data.image_coords_to_view_coord_mat * text_to_image)),
                ),
                (
                    "u_projectionMatrix",
                    UniformValue::Mat3(data.view_projection),
                ),
            ]),
        );

        let px = self.get_cache_pixel(data).unwrap();

        set_buffers_and_attributes(&self.program, &px.buffer_info);
        draw_buffer_info(gl, &px.buffer_info, DrawMode::Triangles);
    }
}
