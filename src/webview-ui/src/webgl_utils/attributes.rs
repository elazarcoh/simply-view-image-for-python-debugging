use super::types::*;
use web_sys::{WebGl2RenderingContext as GL, WebGlBuffer, WebGlProgram};
/**
 * Given typed array creates a WebGLBuffer and copies the typed array
 * into it.
 *
 * @param {WebGLRenderingContext} gl A WebGLRenderingContext
 * @param {ArrayBuffer|SharedArrayBuffer|ArrayBufferView|WebGLBuffer} typedArray the typed array. Note: If a WebGLBuffer is passed in it will just be returned. No action will be taken
 * @param {number} [type] the GL bind type for the buffer. Default = `gl.ARRAY_BUFFER`.
 * @param {number} [drawType] the GL draw type for the buffer. Default = 'gl.STATIC_DRAW`.
 * @return {WebGLBuffer} the created WebGLBuffer
 * @memberOf module:twgl/attributes
 */
// function createBufferFromTypedArray(gl, typedArray, type, drawType) {
//   if (helper.isBuffer(gl, typedArray)) {
//     return typedArray;
//   }
//   type = type || ARRAY_BUFFER;
//   const buffer = gl.createBuffer();
//   setBufferFromTypedArray(gl, type, buffer, typedArray, drawType);
//   return buffer;
// }
pub trait IntoJsArray {
    type JsArray: AsRef<js_sys::Object>;
    fn into_js_array(self) -> Self::JsArray;
}

impl IntoJsArray for &[f32] {
    type JsArray = js_sys::Float32Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Float32Array::from(self)
    }
}

pub fn create_buffer_from_data<T: IntoJsArray>(
    gl: &GL,
    data: T,
    buffer_type: Option<GLConstant>,
    draw_type: Option<GLConstant>,
) -> Result<WebGlBuffer, String> {
    let buffer = gl.create_buffer().ok_or("Could not create buffer")?;
    let buffer_type_ = buffer_type.unwrap_or(GL::ARRAY_BUFFER);
    let draw_type_ = draw_type.unwrap_or(GL::STATIC_DRAW);
    gl.bind_buffer(buffer_type_, Some(&buffer));
    let array = data.into_js_array();
    gl.buffer_data_with_array_buffer_view(buffer_type_, array.as_ref(), draw_type_);
    gl.bind_buffer(buffer_type_, None);
    Ok(buffer)
}
// pub fn create_buffer_info_from_data<T: IntoJsArray>(
//     gl: &GL,
//     data: ArraySpec<T>,
// ) -> Result<BufferInfo, String> {

// }

pub fn create_attributes_from_array<T>(gl: &GL, array: ArraySpec<T>) -> Result<AttribInfo, String>
where
    T: IntoJsArray + ElementTypeFor,
{
    let attrib_name = array.name;
    let buffer = match array.data {
        ArrayData::Slice(s) => create_buffer_from_data(gl, s, None, None)?,
    };
    let gl_type = T::ELEMENT_TYPE;
    let num_components = array.num_components;
    Ok(AttribInfo {
        name: attrib_name,
        num_components,
        buffer,
        gl_type,
    })
}
