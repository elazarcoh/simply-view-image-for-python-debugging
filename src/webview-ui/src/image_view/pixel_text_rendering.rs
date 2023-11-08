use std::{collections::HashMap, iter::FromIterator, ops::Deref, rc::Rc};

use ab_glyph::{Font, FontArc, Glyph, GlyphId, Point, PxScale, Rect};
use glam::{Mat3, Vec4};
use glyph_brush::{GlyphBrush, GlyphBrushBuilder};
use glyph_brush_draw_cache::{DrawCache, Rectangle};
use glyph_brush_layout::{GlyphPositioner, Layout, SectionGeometry, SectionText};
use image::DynamicImage;
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

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum PixelValue {
    Rgba(u8, u8, u8, u8),
}

pub type PixelLoc = glam::UVec2;

impl PixelValue {
    pub fn from_image(image: &image::DynamicImage, pixel: &PixelLoc) -> Self {
        match image {
            DynamicImage::ImageRgba8(image) => {
                let pixel = image.get_pixel(pixel.x, pixel.y);
                Self::Rgba(pixel[0], pixel[1], pixel[2], pixel[3])
            }
            _ => todo!(),
        }
    }

    fn format_value(&self) -> String {
        match self {
            Self::Rgba(r, g, b, a) => format!("{:.2}\n{:.2}\n{:.2}\n{:.2}", r, g, b, a),
        }
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
            pixel_value: pixel_value.clone(),
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
        let required_letters = "0123456789., -+enaif";
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
        self.draw_cache
            .cache_queued(&[&font], update_texture)
            .unwrap();
    }

    fn glyph_uv(&self, section_glyph: &glyph_brush_layout::SectionGlyph) -> Option<(Rect, Rect)> {
        self.glyphs
            .get(&section_glyph.glyph.id)
            .map(|(_, glyph)| {
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
            .flatten()
    }
}

pub(super) struct PixelTextCache(HashMap<PixelLoc, PixelTextData>);

pub(super) struct PixelTextRenderingData<'a> {
    pub pixel_text_cache: &'a mut PixelTextCache,
    pub pixel_loc: &'a PixelLoc,
    pub pixel_value: &'a PixelValue,
    pub image_coords_to_view_coord_mat: &'a Mat3,
    pub view_projection: &'a Mat3,
}

impl PixelTextRenderer {
    pub fn try_new(gl: &WebGl2RenderingContext) -> Result<Self, String> {
        let font =
            FontArc::try_from_slice(include_bytes!("../../assets/fonts/ChakraPetch-Regular.ttf"))
                .map_err(|e| e.to_string())?;

        let text_program = webgl_utils::program::GLProgramBuilder::new(&gl)
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
        pixel_loc: &PixelLoc,
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

        // let pixel_text = "454\n123";
        let pixel_text = pixel_value.format_value();

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
            .set_content(&bytemuck::cast_slice(&uvs), 0)
            .unwrap();
        pixel_data
            .position_buffer()
            .set_content(&bytemuck::cast_slice(&bbox), 0)
            .unwrap();
        pixel_data.buffer_info.num_elements = 6 * num_rendered_glyphs;
    }

    fn get_cache_pixel<'a>(
        &self,
        data: PixelTextRenderingData<'a>,
    ) -> Result<&'a PixelTextData, String> {
        if let Some(pixel_data) = data.pixel_text_cache.0.get_mut(&data.pixel_loc) {
            if pixel_data.pixel_value != *data.pixel_value {
                // log::debug!("Updating pixel text cache");
                Self::pixel_value_into_buffers(
                    data.pixel_loc,
                    data.pixel_value,
                    &self.glyph_texture,
                    &self.font,
                    pixel_data,
                );
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
        Ok(data.pixel_text_cache.0.get(&data.pixel_loc).unwrap())
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
                // (
                //     "u_pixelColor",
                //     UniformValue::Vec4(&Vec4::new(1.0, 0.0, 0.0, 1.0)),
                // ),
                (
                    "u_imageToScreenMatrix",
                    UniformValue::Mat3(&(*data.image_coords_to_view_coord_mat * text_to_image)),
                ),
                (
                    "u_projectionMatrix",
                    UniformValue::Mat3(&data.view_projection),
                ),
            ]),
        );

        let px = self.get_cache_pixel(data).unwrap();

        // {
        //     let v_u8 = utils::buffer_content_as_vec(
        //         &self.gl,
        //         &px.buffer_info.get_attrib("vin_position").unwrap().buffer,
        //         6 * 2 * 4,
        //     );
        //     let v_f32: &[f32] = bytemuck::cast_slice(&v_u8);
        //     log::debug!("Pos: {:?}", v_f32);
        // }
        // {
        //     let v_u8 = utils::buffer_content_as_vec(
        //         &self.gl,
        //         &px.buffer_info.get_attrib("uv").unwrap().buffer,
        //         6 * 2 * 4,
        //     );
        //     let v_f32: &[f32] = bytemuck::cast_slice(&v_u8);
        //     log::debug!("UV: {:?}", v_f32);
        // }
        // log::debug!("num_elements: {:?}", px.buffer_info.num_elements);

        set_buffers_and_attributes(&self.program, &px.buffer_info);
        draw_buffer_info(gl, &px.buffer_info, DrawMode::Triangles);
    }
}
