use std::convert::TryInto;

use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::types::*;


cfg_if! {
    if #[cfg(feature = "image")] {

    use image::DynamicImage;

    pub fn create_texture_from_image(gl: &GL, image: &DynamicImage) -> Result<GLGuard<WebGlTexture>, String> {
        let tex = gl_guarded(gl.clone(), |gl| {
            gl.create_texture().ok_or("Could not create texture")
        })?;
        let width = image.width();
        let height = image.height();
        gl.bind_texture(GL::TEXTURE_2D, Some(&tex));
        let internal_format = GL::RGBA;
        let format = GL::RGBA;
        let type_ = element_type_for_dynamic_image(image);
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            GL::TEXTURE_2D,
            0,
            internal_format as i32,
            width as i32,
            height as i32,
            0,
            format,
            type_.into(),
            Some(image.as_bytes()),
        ).map_err(|jsvalue| format!("Could not create texture from image: {:?}", jsvalue))?;
        Ok(tex)
    }

    }
}
