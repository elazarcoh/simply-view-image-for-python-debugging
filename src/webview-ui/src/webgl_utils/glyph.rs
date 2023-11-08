use glyph_brush::{ab_glyph::FontArc, FontId, GlyphBrush, GlyphBrushBuilder};
use web_sys::{WebGl2RenderingContext, WebGlTexture};

use crate::common::Size;

pub struct GlyphRendering {
    gl: WebGl2RenderingContext,
    font: FontArc,
}

impl GlyphRendering {
    fn create_texture(gl: &WebGl2RenderingContext, size: Size) -> Result<WebGlTexture, String> {
        let texture = gl
            .create_texture()
            .ok_or("Could not create texture.".to_string())?;
        gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            WebGl2RenderingContext::TEXTURE_2D,
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
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_WRAP_S,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_WRAP_T,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MIN_FILTER,
            WebGl2RenderingContext::NEAREST as i32,
        );
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            WebGl2RenderingContext::NEAREST as i32,
        );

        Ok(texture)
    }

    fn prepare_gylph_texturep() {}

    pub fn try_new(gl: WebGl2RenderingContext) -> Result<Self, String> {
        let font =
            FontArc::try_from_slice(include_bytes!("../../assets/fonts/ChakraPetch-Regular.ttf"))
                .map_err(|e| e.to_string())?;
        let texture = Self::create_texture(
            &gl,
            Size {
                width: 1024.0,
                height: 1024.0,
            },
        )?;
        // let glyph_brush: GlyphBrush<QuadData> = { GlyphBrushBuilder::using_font(font).build() };

        Ok(Self { gl, font })
    }
}
