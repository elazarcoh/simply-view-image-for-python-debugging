use anyhow::Result;
use enumset::EnumSetType;
use std::borrow::Cow;

use crate::webgl_utils::{self, GLGuard, error::WebGlError};

#[derive(EnumSetType, Debug)]
pub(crate) enum ColorMapKind {
    Linear,
    Diverging,
    Categorical,
}

#[derive(Debug, Clone)]
pub(crate) struct ColorMap {
    pub name: Cow<'static, str>,
    pub kind: ColorMapKind,
    pub map: Cow<'static, [[f32; 3]]>,
}

impl ColorMap {
    pub(crate) const fn new(
        name: &'static str,
        kind: ColorMapKind,
        map: &'static [[f32; 3]],
    ) -> Self {
        Self {
            name: Cow::Borrowed(name),
            kind,
            map: Cow::Borrowed(map),
        }
    }
}

pub(crate) fn create_texture_for_colormap(
    gl: &web_sys::WebGl2RenderingContext,
    colormap: &ColorMap,
) -> Result<GLGuard<web_sys::WebGlTexture>> {
    let tex = webgl_utils::gl_guarded(gl.clone(), |gl| {
        gl.create_texture()
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "create_texture"))
    })?;
    let width = colormap.map.len() as u32;
    let height = 1;
    let internal_format = webgl_utils::InternalFormat::RGB32F;
    let format = webgl_utils::Format::Rgb;
    let type_ = webgl_utils::ElementType::Float;

    gl.bind_texture(webgl_utils::TextureTarget::Texture2D as _, Some(&tex));
    gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_array_buffer_view_and_src_offset(
        webgl_utils::TextureTarget::Texture2D as _,
        0,
        internal_format as _,
        width as _,
        height as _,
        0,
        format as _,
        type_ as _,
        &webgl_utils::utils::js_typed_array_from_bytes(bytemuck::cast_slice(&colormap.map), type_),
        0,
    )
    .map_err(|jsvalue| WebGlError::from_js_value(&jsvalue, "tex_image_2d"))?;

    gl.tex_parameteri(
        webgl_utils::TextureTarget::Texture2D as _,
        web_sys::WebGl2RenderingContext::TEXTURE_MAG_FILTER,
        match colormap.kind {
            ColorMapKind::Linear => webgl_utils::TextureMagFilter::Linear,
            ColorMapKind::Diverging => webgl_utils::TextureMagFilter::Linear,
            ColorMapKind::Categorical => webgl_utils::TextureMagFilter::Nearest,
        } as _,
    );
    gl.tex_parameteri(
        webgl_utils::TextureTarget::Texture2D as _,
        web_sys::WebGl2RenderingContext::TEXTURE_MIN_FILTER,
        match colormap.kind {
            ColorMapKind::Linear => webgl_utils::TextureMinFilter::Linear,
            ColorMapKind::Diverging => webgl_utils::TextureMinFilter::Linear,
            ColorMapKind::Categorical => webgl_utils::TextureMinFilter::Nearest,
        } as _,
    );
    gl.tex_parameteri(
        webgl_utils::TextureTarget::Texture2D as _,
        web_sys::WebGl2RenderingContext::TEXTURE_WRAP_S,
        webgl_utils::TextureWrap::ClampToEdge as _,
    );
    gl.tex_parameteri(
        webgl_utils::TextureTarget::Texture2D as _,
        web_sys::WebGl2RenderingContext::TEXTURE_WRAP_T,
        webgl_utils::TextureWrap::ClampToEdge as _,
    );

    Ok(tex)
}
