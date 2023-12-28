use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use super::ElementType;

// used for debugging
#[allow(dead_code)]
pub(crate) fn buffer_content_as_vec(
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

pub(crate) fn js_typed_array_from_bytes(bytes: &[u8], element_type: ElementType) -> js_sys::Object {
    let array_buffer = js_sys::Uint8Array::from(bytes).buffer();
    match element_type {
        ElementType::Byte => js_sys::Int8Array::new(&array_buffer).into(),
        ElementType::UnsignedByte => js_sys::Uint8Array::new(&array_buffer).into(),
        ElementType::Short => js_sys::Int16Array::new(&array_buffer).into(),
        ElementType::UnsignedShort => js_sys::Uint16Array::new(&array_buffer).into(),
        ElementType::Int => js_sys::Int32Array::new(&array_buffer).into(),
        ElementType::UnsignedInt => js_sys::Uint32Array::new(&array_buffer).into(),
        ElementType::Float => js_sys::Float32Array::new(&array_buffer).into(),
    }
}
