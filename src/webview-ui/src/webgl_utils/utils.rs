use web_sys::{WebGl2RenderingContext, WebGlBuffer};


pub fn buffer_content_as_vec(
    gl: &WebGl2RenderingContext,
    buf: &WebGlBuffer,
    size: usize,
) -> Vec<u8> {
    let mut content = vec![0; size];
    gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(buf));
    gl.get_buffer_sub_data_with_i32_and_u8_array(
        WebGl2RenderingContext::ARRAY_BUFFER,
        0,
        &mut content,
    );
    content
}