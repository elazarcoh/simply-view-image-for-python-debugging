use anyhow::Result;
use web_sys::WebGl2RenderingContext;

use crate::webgl_utils::error::WebGlError;

use super::WebGlExtension;

pub(crate) fn enable_extension(
    gl: &WebGl2RenderingContext,
    ext: WebGlExtension,
) -> Result<Option<js_sys::Object>> {
    let name = match ext {
        WebGlExtension::OesVertexArrayObject => "OES_vertex_array_object",
        WebGlExtension::OesTextureFloat => "OES_texture_float",
        WebGlExtension::OesTextureFloatLinear => "OES_texture_float_linear",
        WebGlExtension::ExtColorBufferFloat => "EXT_color_buffer_float",
    };
    log::debug!("Enabling extension {:?} ({})", ext, name);
    Ok(gl
        .get_extension(name)
        .map_err(|js_value| WebGlError::from_js_value(&js_value, "get_extension"))?)
}
