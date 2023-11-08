use glyph_brush::{
    ab_glyph::FontArc,
    ab_glyph::{Font, Rect},
    GlyphBrush, GlyphBrushBuilder, Rectangle,
};
use web_sys::{WebGl2RenderingContext, WebGlTexture};

use crate::{
    common::Size,
    webgl_utils::{self, *},
};

pub struct TextRendering {
    gl: WebGl2RenderingContext,
    glyph_brush: GlyphBrush<SingleGlyphData>,
    program: ProgramBundle,
    texture: GLGuard<WebGlTexture>,
}

#[derive(Copy, Clone)]
#[repr(C)]
struct SingleGlyphData {
    positions: [f32; 8],
    tex_coords: [f32; 8],
    indices: [u32; 6],
}

fn rect_to_positions(rect: Rect) -> [f32; 8] {
    [
        rect.min.x, rect.min.y, rect.max.x, rect.min.y, rect.min.x, rect.max.y, rect.max.x,
        rect.max.y,
    ]
}

impl SingleGlyphData {
    fn from_brush_vertex(vertex: glyph_brush::GlyphVertex) -> Self {
        Self {
            positions: rect_to_positions(vertex.pixel_coords),
            tex_coords: rect_to_positions(vertex.tex_coords),
            indices: [0, 1, 2, 2, 1, 3],
        }
    }
}

impl TextRendering {
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

        Ok(Self {
            gl,
            glyph_brush,
            program: text_program,
            texture,
        })
    }

    pub fn render(&mut self) {
        let gl = &self.gl;
        let program = &self.program;
        let texture = &self.texture;

        let update_texture = move |rect: Rectangle<u32>, tex_data: &[u8]| {
            gl.bind_texture(TextureTarget::Texture2D as _, Some(&texture));

            gl.tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_u8_array(
                TextureTarget::Texture2D as _,
                0,                                 
                rect.min[0] as _,                  
                rect.min[1] as _,                  
                rect.width() as _,
                rect.height() as _,
                WebGl2RenderingContext::RED,       
                WebGl2RenderingContext::UNSIGNED_BYTE,
                Some(&tex_data),
            )
            .unwrap();
        };

        match self
            .glyph_brush
            .process_queued(update_texture, SingleGlyphData::from_brush_vertex)
        {
            Ok(glyph_brush::BrushAction::Draw(x)) => {}

            Ok(glyph_brush::BrushAction::ReDraw) => {}

            Err(e) => {}
        };
    }
}
