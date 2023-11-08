

use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::types::*;

cfg_if! {
    if #[cfg(feature = "image")] {

    use image::DynamicImage;

    pub fn create_texture_from_image(gl: &GL, image: &DynamicImage,
        parameters: CreateTextureParameters
    ) -> Result<GLGuard<WebGlTexture>, String> {
        let tex = gl_guarded(gl.clone(), |gl| {
            gl.create_texture().ok_or("Could not create texture")
        })?;
        let width = image.width();
        let height = image.height();
        gl.bind_texture(TextureTarget::Texture2D as _, Some(&tex));
        let internal_format = GL::RGBA;
        let format = GL::RGBA;
        let type_ = element_type_for_dynamic_image(image);
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_u8_array_and_src_offset(
            TextureTarget::Texture2D as _,
            0,
            internal_format as i32,
            width as i32,
            height as i32,
            0,
            format,
            type_ as GLConstant,
            image.as_bytes(),
            0,
        ).map_err(|jsvalue| format!("Could not create texture from image: {:?}", jsvalue))?;

        if let Some(mag_filter) = parameters.mag_filter { gl.tex_parameteri(TextureTarget::Texture2D as _, GL::TEXTURE_MAG_FILTER, mag_filter as i32); }
        if let Some(min_filter) = parameters.min_filter { gl.tex_parameteri(TextureTarget::Texture2D as _, GL::TEXTURE_MIN_FILTER, min_filter as i32); }
        if let Some(wrap_s) = parameters.wrap_s { gl.tex_parameteri(TextureTarget::Texture2D as _, GL::TEXTURE_WRAP_S, wrap_s as i32); }
        if let Some(wrap_t) = parameters.wrap_t { gl.tex_parameteri(TextureTarget::Texture2D as _, GL::TEXTURE_WRAP_T, wrap_t as i32); }

        Ok(tex)
    }

    }
}
