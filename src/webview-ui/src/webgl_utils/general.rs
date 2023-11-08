use web_sys::WebGl2RenderingContext;

use super::WebGlExtension;

pub fn enable_extension(gl: &WebGl2RenderingContext, ext: WebGlExtension) -> Result<Option<js_sys::Object>, String> {
    let name = match ext {
        WebGlExtension::OesVertexArrayObject => "OES_vertex_array_object",
        WebGlExtension::OesTextureFloat => "OES_texture_float",
        WebGlExtension::OesTextureFloatLinear => "OES_texture_float_linear",
        WebGlExtension::ExtColorBufferFloat => "EXT_color_buffer_float",
    };
    log::debug!("Enabling extension {:?} ({})", ext, name);
    gl.get_extension(name)
        .map_err(|e| format!("Could not enable extension {:?}: {:?}", ext, e))
}
