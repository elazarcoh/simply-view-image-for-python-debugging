use std::{collections::HashMap, iter::FromIterator, ops::Deref, rc::Rc};

use ab_glyph::{Font, FontArc, Glyph, Point, PxScale, Rect, GlyphId};
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

pub struct TextRenderer {
    gl: WebGl2RenderingContext,
    // font: FontArc,
    // draw_cache: DrawCache,
    // glyph_cache: HashMap<char, Glyph>,
    pixel_text_cache: PixelTextCache,
    // glyph_brush: GlyphBrush<SingleGlyphData>,
    program: ProgramBundle,
    // texture: GLGuard<WebGlTexture>,
    // buffers: Buffers,
}

// #[derive(Copy, Clone)]
// #[repr(C)]
// struct SingleGlyphData {
//     positions: [f32; 12],
//     tex_coords: [f32; 12],
// }

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

// impl SingleGlyphData {
//     fn from_brush_vertex(vertex: glyph_brush::GlyphVertex) -> Self {
//         Self {
//             positions: rect_to_positions(vertex.pixel_coords),
//             tex_coords: rect_to_positions(vertex.tex_coords),
//         }
//     }
// }

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
enum PixelValue {
    Rgba(u8, u8, u8, u8),
}

impl PixelValue {
    fn from_image(image: &image::DynamicImage, x: u32, y: u32) -> Self {
        match image {
            DynamicImage::ImageRgba8(image) => {
                let pixel = image.get_pixel(x, y);
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

struct Buffers1<'a> {
    uv_buffer: &'a mut ReusableBuffer,
    position_buffer: &'a mut ReusableBuffer,
}

impl PixelTextData {
    fn try_new(gl: &WebGl2RenderingContext, pixel_value: PixelValue) -> Result<Self, String> {
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
            pixel_value,
        })
    }

    fn create_buffer_for_pixel(gl: &WebGl2RenderingContext) -> Result<ReusableBuffer, String> {
        ReusableBuffer::new(gl.clone(), 1024)
    }

    // fn buffers(&mut self) -> Buffers1 {
    //     let (uv_attr, pos_attr) = self.buffer_info.attribs.split_at_mut(1);
    //     let uv_buffer = &mut uv_attr[0].buffer;
    //     let position_buffer = &mut pos_attr[0].buffer;
    //     Buffers1 {
    //         uv_buffer,
    //         position_buffer,
    //     }
    // }

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
            log::debug!("Adding glyph to draw cache: {:?}", glyph.glyph);
            self.draw_cache.queue_glyph(0, glyph.glyph.clone());
        }

        let texture = &self.texture;
        let gl = &self.gl;
        let update_texture = |rect: Rectangle<u32>, tex_data: &[u8]| {
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
        self.draw_cache
            .cache_queued(&[&font], update_texture)
            .unwrap();
    }

    fn glyph_uv(
        &self,
        section_glyph: &glyph_brush_layout::SectionGlyph,
    ) -> Option<(Rect, Rect)> {
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

struct PixelTextCache {
    gl: WebGl2RenderingContext,
    font: FontArc,
    glyph_texture: GlyphTexture,

    pixel_text_cache: HashMap<(i32, i32), PixelTextData>,
}

impl PixelTextCache {
    pub fn try_new(gl: WebGl2RenderingContext, font: FontArc) -> Result<Self, String> {
        let mut glyph_texture = GlyphTexture::try_new(gl.clone())?;
        glyph_texture.prepare_glyphs(&font);
        Ok(Self {
            gl: gl.clone(),
            font,
            glyph_texture,
            pixel_text_cache: HashMap::new(),
        })
    }

    fn pixel_value_into_buffers(
        pixel_value: PixelValue,
        glyph_texture: &GlyphTexture,
        font: &FontArc,
        // uv_buffer: &mut ReusableBuffer,
        // pos_buffer: &mut ReusableBuffer,
        // buffers: &mut Buffers1,
        pixel_data: &mut PixelTextData,
    ) {
        let pixel_text = "454\n123";
        // let pixel_text = pixel_value.format_value();
        log::debug!("Pixel text: {}", pixel_text);
        let glyphs = Layout::default()
            // .v_align(glyph_brush_layout::VerticalAlign::Center)
            // .h_align(glyph_brush_layout::HorizontalAlign::Center)
            .calculate_glyphs(
                &[font],
                &SectionGeometry {
                    screen_position: (0.0, 0.0),
                    ..SectionGeometry::default()
                },
                &[SectionText {
                    text: &pixel_text,
                    scale: PxScale::from(100.0),
                    font_id: glyph_brush_layout::FontId(0),
                }],
            );
        log::debug!("Glyphs: {:?}", glyphs);
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

        log::debug!("UVs: {:?}", uvs);
        log::debug!("BBox: {:?}", bbox);

        pixel_data
            .uv_buffer()
            .set_content(
                &bytemuck::cast_slice(&uvs),
                // &bytemuck::cast_slice(&[
                //     0.0_f32, 0.0, // TL
                //     1.0, 0.0, // TR
                //     0.0, 1.0, // BL
                //     0.0, 1.0, // BL
                //     1.0, 0.0, // TR
                //     1.0, 1.0, // BR
                // ]),
                0,
            )
            .unwrap();
        pixel_data
            .position_buffer()
            .set_content(
                &bytemuck::cast_slice(&bbox),
                // &bytemuck::cast_slice(&[
                //     0.0_f32, 0.0, // TL
                //     1.0, 0.0, // TR
                //     0.0, 1.0, // BL
                //     0.0, 1.0, // BL
                //     1.0, 0.0, // TR
                //     1.0, 1.0, // BR
                // ]),
                0,
            )
            .unwrap();
        pixel_data.buffer_info.num_elements = 6 * num_rendered_glyphs;
        log::debug!("pixel_value_into_buffers");
    }

    pub fn get_cache_pixel(
        &mut self,
        x: i32,
        y: i32,
        image: &image::DynamicImage,
    ) -> Result<&PixelTextData, String> {
        let pixel = PixelValue::from_image(image, x as _, y as _);
        if let Some(pixel_data) = self.pixel_text_cache.get_mut(&(x, y)) {
            if pixel_data.pixel_value != pixel {
                log::debug!("Updating pixel text cache");
                Self::pixel_value_into_buffers(pixel, &self.glyph_texture, &self.font, pixel_data);
            }
        } else {
            log::debug!("Creating new pixel text cache");
            let mut pixel_data = PixelTextData::try_new(&self.gl, pixel)?;
            Self::pixel_value_into_buffers(pixel, &self.glyph_texture, &self.font, &mut pixel_data);

            self.pixel_text_cache.insert((x, y), pixel_data);
        }
        Ok(self.pixel_text_cache.get(&(x, y)).unwrap())
    }
}

fn create_debug_texture(gl: &WebGl2RenderingContext) -> Result<super::types::TextureImage, String> {
    let data = [
        0u8, 0, 0, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1,
        153, 217, 234, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76,
        1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 34, 177, 76, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34,
        177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242,
        0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34,
        177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28,
        36, 1, 237, 28, 36, 1, 34, 177, 76, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34,
        177, 76, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217,
        234, 1, 153, 217, 234, 1, 237, 28, 36, 1, 34, 177, 76, 1, 237, 28, 36, 1, 237, 28, 36, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 0, 0, 0, 1, 0, 0, 0, 1, 255, 255, 255, 1, 34, 177, 76,
        1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 185, 122, 87, 1, 237, 28, 36, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 0, 0, 0, 1, 34, 177, 76, 1, 200, 191, 231, 1, 200, 191, 231,
        1, 200, 191, 231, 1, 34, 177, 76, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177,
        76, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1,
        185, 122, 87, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1,
        34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        34, 177, 76, 1, 63, 72, 204, 1, 0, 0, 0, 1, 34, 177, 76, 1, 185, 122, 87, 1, 185, 122, 87,
        1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1,
        153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63,
        72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87,
        1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 237, 28, 36, 1, 153, 217, 234, 1,
        153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72,
        204, 1, 34, 177, 76, 1, 0, 0, 0, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185,
        122, 87, 1, 237, 28, 36, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217,
        234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174,
        201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174,
        201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 127, 127, 127, 1,
        127, 127, 127, 1, 0, 0, 0, 1, 185, 122, 87, 1, 237, 28, 36, 1, 237, 28, 36, 1, 255, 242, 0,
        1, 255, 242, 0, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1,
        34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63,
        72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 0, 0, 0, 1,
        237, 28, 36, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 153, 217,
        234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174,
        201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174,
        201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1,
        34, 177, 76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 237, 28, 36, 1, 0, 0, 0, 1, 0, 0, 0, 1,
        255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34,
        177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 127, 127, 127,
        1, 237, 28, 36, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 255, 242, 0, 1,
        255, 242, 0, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34,
        177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72,
        204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 237, 28, 36, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 237, 28, 36, 1,
        153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        34, 177, 76, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34, 177,
        76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242,
        0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 34, 177, 76, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34, 177, 76, 1, 237, 28,
        36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 127, 127, 127, 1, 127, 127, 127, 1,
        34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242,
        0, 1, 34, 177, 76, 1, 34, 177, 76, 1, 34, 177, 76, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1,
        63, 72, 204, 1, 34, 177, 76, 1, 34, 177, 76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 127,
        127, 127, 1, 127, 127, 127, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0,
        1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 34, 177,
        76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 127, 127, 127, 1, 127, 127, 127, 1, 34, 177, 76,
        1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
    ];
    // let solid_image_data =
    //     image::ImageBuffer::from_fn(256, 256, |x, y| image::Rgba([255u8, 255, 0, 255]));
    let data_vec = data.iter().map(|x| *x).collect::<Vec<u8>>();
    let solid_image_data = image::ImageBuffer::from_raw(25, 25, data_vec).unwrap();
    let solid_image = image::DynamicImage::ImageRgba8(solid_image_data);

    super::types::TextureImage::try_new(solid_image, gl)
}

impl TextRenderer {
    // fn create_texture(
    //     gl: &WebGl2RenderingContext,
    //     size: Size,
    // ) -> Result<GLGuard<WebGlTexture>, String> {
    //     let texture = gl
    //         .create_texture()
    //         .ok_or("Could not create texture.".to_string())?;
    //     gl.bind_texture(TextureTarget::Texture2D as _, Some(&texture));
    //     gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
    //         TextureTarget::Texture2D as _,
    //         0,
    //         WebGl2RenderingContext::R8 as _,
    //         size.width as _,
    //         size.height as _,
    //         0,
    //         WebGl2RenderingContext::RED,
    //         WebGl2RenderingContext::UNSIGNED_BYTE,
    //         None,
    //     )
    //     .map_err(|jsvalue| format!("Could not create texture: {:?}", jsvalue))?;

    //     gl.pixel_storei(WebGl2RenderingContext::UNPACK_ALIGNMENT, 1);
    //     gl.tex_parameteri(
    //         TextureTarget::Texture2D as _,
    //         WebGl2RenderingContext::TEXTURE_WRAP_S,
    //         WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
    //     );
    //     gl.tex_parameteri(
    //         TextureTarget::Texture2D as _,
    //         WebGl2RenderingContext::TEXTURE_WRAP_T,
    //         WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
    //     );
    //     gl.tex_parameteri(
    //         TextureTarget::Texture2D as _,
    //         WebGl2RenderingContext::TEXTURE_MIN_FILTER,
    //         WebGl2RenderingContext::NEAREST as i32,
    //     );
    //     gl.tex_parameteri(
    //         TextureTarget::Texture2D as _,
    //         WebGl2RenderingContext::TEXTURE_MAG_FILTER,
    //         WebGl2RenderingContext::NEAREST as i32,
    //     );

    //     Ok(GLGuard {
    //         gl: gl.clone(),
    //         obj: texture,
    //     })
    // }

    pub fn try_new(gl: WebGl2RenderingContext) -> Result<Self, String> {
        let font =
            FontArc::try_from_slice(include_bytes!("../../assets/fonts/ChakraPetch-Regular.ttf"))
                .map_err(|e| e.to_string())?;

        // let mut glyph_cache = HashMap::new();
        // let scale = 100.0;
        // let required_letters = "0123456789., -+enaif";
        // let glyphs = &required_letters
        //     .chars()
        //     .map(|c| font.glyph_id(c).with_scale(scale))
        //     .collect::<Vec<_>>();
        // let glyphs = Layout::default().calculate_glyphs(
        //     &[&font],
        //     &SectionGeometry {
        //         ..SectionGeometry::default()
        //     },
        //     &[SectionText {
        //         text: required_letters,
        //         scale: PxScale::from(scale),
        //         font_id: glyph_brush_layout::FontId(0),
        //     }],
        // );
        // log::debug!("Glyphs: {:?}", glyphs);
        // required_letters
        //     .chars()
        //     .zip(glyphs.iter())
        //     .for_each(|(c, glyph)| {
        //         glyph_cache.insert(c, glyph.glyph.clone());
        //     });

        // let mut draw_cache = DrawCache::builder().build();
        // for glyph in glyphs {
        //     draw_cache.queue_glyph(0, glyph.glyph.clone());
        // }
        // let texture1 = Self::create_texture(
        //     &gl,
        //     Size::from_width_and_height_u32(draw_cache.dimensions()),
        // )?;

        // let update_texture = |rect: Rectangle<u32>, tex_data: &[u8]| {
        //     log::debug!("Updating texture");
        //     gl.bind_texture(TextureTarget::Texture2D as _, Some(&texture1));

        //     gl.tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_u8_array(
        //         TextureTarget::Texture2D as _,
        //         0,
        //         rect.min[0] as _,
        //         rect.min[1] as _,
        //         rect.width() as _,
        //         rect.height() as _,
        //         Format::Red as _,
        //         ElementType::UnsignedByte as _,
        //         Some(&tex_data),
        //     )
        //     .unwrap();
        // };
        // draw_cache.cache_queued(&[&font], update_texture).unwrap();

        // let glyph_brush: GlyphBrush<SingleGlyphData> =
        //     { GlyphBrushBuilder::using_font(font).build() };
        // let texture = Self::create_texture(
        //     &gl,
        //     Size::from_width_and_height_u32(glyph_brush.texture_dimensions()),
        // )?;

        let text_program = webgl_utils::program::GLProgramBuilder::new(&gl)
            .vertex_shader(include_str!("../shaders/text.vert"))
            .fragment_shader(include_str!("../shaders/text.frag"))
            .attribute("vin_position")
            .build()?;

        // let uv_buffer = ReusableBuffer::new(gl.clone(), 1024)?;
        // let position_buffer = ReusableBuffer::new(gl.clone(), 1024)?;
        // let buffers = BufferInfo::<ReusableBuffer> {
        //     num_elements: 0,
        //     attribs: vec![
        //         Attrib {
        //             buffer: uv_buffer,
        //             info: AttribInfo {
        //                 name: "vin_position".to_string(),
        //                 num_components: 2,
        //                 gl_type: ElementType::Float,
        //                 normalized: false,
        //                 stride: 0,
        //             },
        //         },
        //         Attrib {
        //             buffer: position_buffer,
        //             info: AttribInfo {
        //                 name: "uv".to_string(),
        //                 num_components: 2,
        //                 gl_type: ElementType::Float,
        //                 normalized: false,
        //                 stride: 0,
        //             },
        //         },
        //     ],
        //     indices: None,
        // };

        // let buffers = Buffers { buffers };

        let pixel_text_cache = PixelTextCache::try_new(gl.clone(), font.clone())?;

        Ok(Self {
            gl,
            // font,
            // glyph_cache,
            pixel_text_cache,
            // glyph_brush,
            // draw_cache,
            program: text_program,
            // texture: texture1,
            // buffers,
        })
    }

    // pub fn queue_section(&mut self, section: glyph_brush::Section) {
    //     // self.glyph_brush.queue(section);
    // }

    pub fn render(&mut self, image_coords_to_view_coord_mat: &Mat3, view_projection: &Mat3) {
        let gl = &self.gl;
        let program = &self.program;

        // let tex_img = create_debug_texture(&gl).unwrap();
        gl.use_program(Some(&program.program));
        set_uniforms(
            program,
            &HashMap::from([
                (
                    "u_gylphTexture",
                    UniformValue::Texture(&self.pixel_text_cache.glyph_texture.texture),
                ),
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

        let px = self
            .pixel_text_cache
            .get_cache_pixel(
                0,
                0,
                &image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
                    1,
                    1,
                    image::Rgba([255, 0, 0, 255]),
                )),
            )
            .unwrap();

        {
            let v_u8 = utils::buffer_content_as_vec(
                &self.gl,
                &px.buffer_info.get_attrib("vin_position").unwrap().buffer,
                6 * 2 * 4,
            );
            let v_f32: &[f32] = bytemuck::cast_slice(&v_u8);
            log::debug!("Pos: {:?}", v_f32);
        }
        {
            let v_u8 = utils::buffer_content_as_vec(
                &self.gl,
                &px.buffer_info.get_attrib("uv").unwrap().buffer,
                6 * 2 * 4,
            );
            let v_f32: &[f32] = bytemuck::cast_slice(&v_u8);
            log::debug!("UV: {:?}", v_f32);
        }
        log::debug!("num_elements: {:?}", px.buffer_info.num_elements);

        set_buffers_and_attributes(&self.program, &px.buffer_info);
        draw_buffer_info(gl, &px.buffer_info, DrawMode::Triangles);

        // let buffer_info = create_buffer_info_from_arrays(
        //     gl,
        //     Arrays {
        //         f32_arrays: vec![
        //             ArraySpec {
        //                 name: "vin_position".to_string(),
        //                 data: (&[0.0_f32, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1., 1.]),
        //                 num_components: 2,
        //                 normalized: true,
        //                 stride: None,
        //                 target: BindingPoint::ArrayBuffer,
        //             },
        //             ArraySpec {
        //                 name: "uv".to_string(),
        //                 data: (&[0.0_f32, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1., 1.]),
        //                 num_components: 2,
        //                 normalized: true,
        //                 stride: None,
        //                 target: BindingPoint::ArrayBuffer,
        //             },
        //         ],
        //         u8_arrays: vec![] as Vec<ArraySpec<Vec<u8>>>,
        //     },
        //     None,
        // )
        // .unwrap();
        // {
        //     let v_u8 = utils::buffer_content_as_vec(
        //         &self.gl,
        //         &buffer_info.get_attrib("vin_position").unwrap().buffer,
        //         6 * 2 * 4,
        //     );
        //     let v_f32: &[f32] = bytemuck::cast_slice(&v_u8);
        //     log::debug!("Pos: {:?}", v_f32);
        // }
        // {
        //     let v_u8 = utils::buffer_content_as_vec(
        //         &self.gl,
        //         &buffer_info.get_attrib("uv").unwrap().buffer,
        //         6 * 2 * 4,
        //     );
        //     let v_f32: &[f32] = bytemuck::cast_slice(&v_u8);
        //     log::debug!("UV: {:?}", v_f32);
        // }
        // log::debug!("num_elements: {:?}", buffer_info.num_elements);

        // set_buffers_and_attributes(&self.program, &buffer_info);
        // draw_buffer_info(gl, &buffer_info, DrawMode::Triangles);

        // let glyphs = Layout::default().calculate_glyphs(
        //     &[&self.font],
        //     &SectionGeometry {
        //         // screen_position: (150.0, 50.0),
        //         ..SectionGeometry::default()
        //     },
        //     &[SectionText {
        //         text: "1",
        //         scale: PxScale::from(100.0),
        //         font_id: glyph_brush_layout::FontId(0),
        //     }],
        // );
        // log::debug!("Glyphs: {:?}", glyphs);
        // let one_rect = self
        //     .draw_cache
        //     .rect_for(
        //         0,
        //         &Glyph {
        //             position: self.glyph_cache.get(&'1').unwrap().position,
        //             scale: PxScale::from(100.0),
        //             id: self.font.glyph_id('1'),
        //         },
        //     )
        //     .unwrap();
        // let two_rect = self
        //     .draw_cache
        //     .rect_for(
        //         0,
        //         &Glyph {
        //             position: self.glyph_cache.get(&'5').unwrap().position,
        //             scale: PxScale::from(100.0),
        //             id: self.font.glyph_id('5'),
        //         },
        //     )
        //     .unwrap();
        // // let one_rect = self
        // //     .draw_cache
        // //     .rect_for(0, self.glyph_cache.get(&'5').unwrap())
        // //     .unwrap();
        // let one_uv = rect_to_positions(one_rect.0);
        // let one_pos = rect_to_positions(one_rect.1);
        // let two_uv = rect_to_positions(two_rect.0);
        // let two_pos = rect_to_positions(two_rect.1);
        // self.buffers
        //     .uv_buffer()
        //     .set_content(
        //         // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1.0, 0.0, 0.0, 1.0]),
        //         &bytemuck::cast_slice(&one_uv),
        //         0,
        //     )
        //     .unwrap();
        // self.buffers
        //     .uv_buffer()
        //     .set_content(
        //         // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1.0, 0.0, 0.0, 1.0]),
        //         &bytemuck::cast_slice(&two_uv),
        //         12 * 4,
        //     )
        //     .unwrap();
        // self.buffers
        //     .position_buffer()
        //     .set_content(
        //         // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1000.0, 0.0, 0.0, 1000.0]),
        //         &bytemuck::cast_slice(&one_pos),
        //         0,
        //     )
        //     .unwrap();
        // self.buffers
        //     .position_buffer()
        //     .set_content(
        //         // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1000.0, 0.0, 0.0, 1000.0]),
        //         &bytemuck::cast_slice(&two_pos),
        //         12 * 4,
        //     )
        //     .unwrap();
        // self.buffers.buffers.num_elements = 12;
        // self.draw(image_coords_to_view_coord_mat, view_projection)

        // match self
        //     .glyph_brush
        //     .process_queued(update_texture, SingleGlyphData::from_brush_vertex)
        // {
        //     Ok(glyph_brush::BrushAction::Draw(glyphs)) => {
        //         log::debug!("new text");
        //         let mut offset = 0;
        //         let mut num_elements = 0;
        //         for glyph in &glyphs {
        //             self.buffers
        //                 .uv_buffer()
        //                 .set_content(&bytemuck::cast_slice(&glyph.tex_coords), offset)
        //                 .unwrap();
        //             self.buffers
        //                 .position_buffer()
        //                 .set_content(&bytemuck::cast_slice(&glyph.positions), offset)
        //                 .unwrap();
        //             offset += 12 * std::mem::size_of::<f32>();
        //             num_elements += 6;
        //         }
        //         self.buffers.buffers.num_elements = num_elements;

        //         self.draw(image_coords_to_view_coord_mat, view_projection);
        //     }

        //     Ok(glyph_brush::BrushAction::ReDraw) => {
        //         self.draw(image_coords_to_view_coord_mat, view_projection);
        //     }

        //     Err(e) => {
        //         log::error!("Error drawing text: {:?}", e);
        //     }
        // };
    }

    //     fn draw(&self, image_coords_to_view_coord_mat: &Mat3, view_projection: &Mat3) {
    //         let gl = &self.gl;
    //         let program = &self.program;

    //         gl.use_program(Some(&program.program));
    //         set_uniforms(
    //             program,
    //             &HashMap::from([
    //                 ("u_gylphTexture", UniformValue::Texture(&self.texture)),
    //                 // (
    //                 //     "u_pixelColor",
    //                 //     UniformValue::Vec4(&Vec4::new(1.0, 0.0, 0.0, 1.0)),
    //                 // ),
    //                 (
    //                     "u_imageToScreenMatrix",
    //                     UniformValue::Mat3(image_coords_to_view_coord_mat),
    //                 ),
    //                 ("u_projectionMatrix", UniformValue::Mat3(view_projection)),
    //             ]),
    //         );
    //         set_buffers_and_attributes(&self.program, &self.buffers.buffers);
    //         draw_buffer_info(gl, &self.buffers.buffers, DrawMode::Triangles);
    //     }
}
