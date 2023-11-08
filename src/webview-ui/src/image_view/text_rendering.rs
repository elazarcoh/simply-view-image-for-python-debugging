use std::{collections::HashMap, iter::FromIterator, ops::Deref, rc::Rc};

use ab_glyph::{Font, FontArc, Glyph, Point, PxScale, Rect};
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
    font: FontArc,
    draw_cache: DrawCache,
    glyph_cache: HashMap<char, Glyph>,
    pixel_text_cache: PixelTextCache,
    // glyph_brush: GlyphBrush<SingleGlyphData>,
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
    uv_buffer: ReusableBuffer,
    pos_buffer: ReusableBuffer,
    pixel_value: PixelValue,
}

struct GlyphTexture {
    gl: WebGl2RenderingContext,
    texture: GLGuard<WebGlTexture>,
    glyphs: HashMap<char, Glyph>,
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
                self.glyphs.insert(c, glyph.glyph.clone());
            });

        let mut draw_cache = DrawCache::builder().build();
        for glyph in glyphs {
            draw_cache.queue_glyph(0, glyph.glyph.clone());
        }

        let texture = &self.texture;
        let update_texture = |rect: Rectangle<u32>, tex_data: &[u8]| {
            log::debug!("Updating texture");
            self.gl
                .bind_texture(TextureTarget::Texture2D as _, Some(&texture));

            self.gl
                .tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_u8_array(
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
        draw_cache.cache_queued(&[&font], update_texture).unwrap();
    }

    fn glyph_uv(
        &self,
        char: char,
        section_glyph: &glyph_brush_layout::SectionGlyph,
    ) -> Option<Rect> {
        self.glyphs.get(&char).map(|glyph| {
            self.draw_cache
                .rect_for(0, &Glyph { ..*glyph })
                .map(|rect| rect.0)
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

    fn create_buffer_for_pixel(&self) -> Result<ReusableBuffer, String> {
        ReusableBuffer::new(self.gl.clone(), 12 * 4)
    }

    fn pixel_value_into_buffers(
        pixel_value: PixelValue,
        glyph_texture: &GlyphTexture,
        font: &FontArc,
        uv_buffer: &mut ReusableBuffer,
        pos_buffer: &mut ReusableBuffer,
    ) {
        let pixel_text = pixel_value.format_value();
        let glyphs = Layout::default()
            .v_align(glyph_brush_layout::VerticalAlign::Center)
            .h_align(glyph_brush_layout::HorizontalAlign::Center)
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
        let uvs = glyphs
            .iter()
            .zip(pixel_text.chars())
            .filter_map(|(glyph, char)| glyph_texture.glyph_uv(char, glyph))
            .flat_map(|rect| rect_to_positions(rect))
            .collect::<Vec<_>>();
        uv_buffer
            .set_content(&bytemuck::cast_slice(&uvs), 0)
            .unwrap();
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
                let uv_buffer = &mut pixel_data.uv_buffer;
                let pos_buffer = &mut pixel_data.pos_buffer;
                Self::pixel_value_into_buffers(
                    pixel,
                    &self.glyph_texture,
                    &self.font,
                    uv_buffer,
                    pos_buffer,
                );
            }
        } else {
            let mut pixel_data = PixelTextData {
                uv_buffer: self.create_buffer_for_pixel()?,
                pos_buffer: self.create_buffer_for_pixel()?,
                pixel_value: pixel,
            };
            Self::pixel_value_into_buffers(
                pixel,
                &self.glyph_texture,
                &self.font,
                &mut pixel_data.uv_buffer,
                &mut pixel_data.pos_buffer,
            );

            self.pixel_text_cache.insert((x, y), pixel_data);
        }
        Ok(self.pixel_text_cache.get(&(x, y)).unwrap())
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

        let mut glyph_cache = HashMap::new();
        let scale = 100.0;
        let required_letters = "0123456789., -+enaif";
        // let glyphs = &required_letters
        //     .chars()
        //     .map(|c| font.glyph_id(c).with_scale(scale))
        //     .collect::<Vec<_>>();
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
        // log::debug!("Glyphs: {:?}", glyphs);
        required_letters
            .chars()
            .zip(glyphs.iter())
            .for_each(|(c, glyph)| {
                glyph_cache.insert(c, glyph.glyph.clone());
            });

        let mut draw_cache = DrawCache::builder().build();
        for glyph in glyphs {
            draw_cache.queue_glyph(0, glyph.glyph.clone());
        }
        let texture1 = Self::create_texture(
            &gl,
            Size::from_width_and_height_u32(draw_cache.dimensions()),
        )?;

        let update_texture = |rect: Rectangle<u32>, tex_data: &[u8]| {
            log::debug!("Updating texture");
            gl.bind_texture(TextureTarget::Texture2D as _, Some(&texture1));

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
        draw_cache.cache_queued(&[&font], update_texture).unwrap();

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

        let pixel_text_cache = PixelTextCache::try_new(gl.clone(), font.clone())?;

        Ok(Self {
            gl,
            font,
            glyph_cache,
            pixel_text_cache,
            // glyph_brush,
            draw_cache,
            program: text_program,
            texture: texture1,
            buffers,
        })
    }

    pub fn queue_section(&mut self, section: glyph_brush::Section) {
        // self.glyph_brush.queue(section);
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

        let px = self.pixel_text_cache.get_cache_pixel(
            0,
            0,
            &image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
                1,
                1,
                image::Rgba([255, 0, 0, 255]),
            )),
        );

        let glyphs = Layout::default().calculate_glyphs(
            &[&self.font],
            &SectionGeometry {
                // screen_position: (150.0, 50.0),
                ..SectionGeometry::default()
            },
            &[SectionText {
                text: "1",
                scale: PxScale::from(100.0),
                font_id: glyph_brush_layout::FontId(0),
            }],
        );
        // log::debug!("Glyphs: {:?}", glyphs);
        let one_rect = self
            .draw_cache
            .rect_for(
                0,
                &Glyph {
                    position: self.glyph_cache.get(&'1').unwrap().position,
                    scale: PxScale::from(100.0),
                    id: self.font.glyph_id('1'),
                },
            )
            .unwrap();
        let two_rect = self
            .draw_cache
            .rect_for(
                0,
                &Glyph {
                    position: self.glyph_cache.get(&'5').unwrap().position,
                    scale: PxScale::from(100.0),
                    id: self.font.glyph_id('5'),
                },
            )
            .unwrap();
        // let one_rect = self
        //     .draw_cache
        //     .rect_for(0, self.glyph_cache.get(&'5').unwrap())
        //     .unwrap();
        let one_uv = rect_to_positions(one_rect.0);
        let one_pos = rect_to_positions(one_rect.1);
        let two_uv = rect_to_positions(two_rect.0);
        let two_pos = rect_to_positions(two_rect.1);
        self.buffers
            .uv_buffer()
            .set_content(
                // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1.0, 0.0, 0.0, 1.0]),
                &bytemuck::cast_slice(&one_uv),
                0,
            )
            .unwrap();
        self.buffers
            .uv_buffer()
            .set_content(
                // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1.0, 0.0, 0.0, 1.0]),
                &bytemuck::cast_slice(&two_uv),
                12 * 4,
            )
            .unwrap();
        self.buffers
            .position_buffer()
            .set_content(
                // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1000.0, 0.0, 0.0, 1000.0]),
                &bytemuck::cast_slice(&one_pos),
                0,
            )
            .unwrap();
        self.buffers
            .position_buffer()
            .set_content(
                // &bytemuck::cast_slice(&[0.0_f32, 0.0, 1000.0, 0.0, 0.0, 1000.0]),
                &bytemuck::cast_slice(&two_pos),
                12 * 4,
            )
            .unwrap();
        self.buffers.buffers.num_elements = 12;
        self.draw(image_coords_to_view_coord_mat, view_projection)

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
