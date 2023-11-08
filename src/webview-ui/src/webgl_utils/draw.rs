use web_sys::WebGl2RenderingContext as GL;

use super::types::*;

pub(crate) fn draw_buffer_info<B>(gl: &GL, buffer_info: &BufferInfo<B>, draw_mode: DrawMode)
where
    B: GLBuffer,
{
    if let Some(_indices) = buffer_info.indices.as_ref() {
        gl.draw_elements_with_i32(
            draw_mode as _,
            buffer_info.num_elements as i32,
            GL::UNSIGNED_SHORT,
            0,
        );
    } else {
        gl.draw_arrays(draw_mode as _, 0, buffer_info.num_elements as i32);
    }
}
