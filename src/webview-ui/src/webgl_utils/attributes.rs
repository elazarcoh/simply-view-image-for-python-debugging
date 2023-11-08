use super::types::GLConstant;
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
trait CorrespondingJsArray {
    type JsArray;
}

impl CorrespondingJsArray for f32 {
    type JsArray = js_sys::Float32Array;
}

// fn into_js_array<T: CorrespondingJsArray>(slice: T) -> T::JsArray {
//     let array = T::JsArray::from(slice);
//     array
// }

// fn foo(slice: &[f32]) {
//     let x = <&[f32] as CorrespondingJsArray>::JsArray::from(slice);
// }

fn into_js_array<T: CorrespondingJsArray>(slice: &[T]) {
    let array: <T as CorrespondingJsArray>::JsArray =
        <T as CorrespondingJsArray>::JsArray::from(slice);
}

fn bar(slice: &[f32]) {
    let _ = into_js_array(slice);
}


// pub fn create_buffer_from_slice<T: CorrespondingJsArray>(
//     gl: &GL,
//     slice: &[T],
//     buffer_type: Option<GLConstant>,
//     draw_type: Option<GLConstant>,
// ) -> Result<WebGlBuffer, String> {
//     let buffer = gl.create_buffer().ok_or("Could not create buffer")?;
//     let buffer_type_ = buffer_type.unwrap_or(GL::ARRAY_BUFFER);
//     let draw_type_ = draw_type.unwrap_or(GL::STATIC_DRAW);
//     gl.bind_buffer(buffer_type_, Some(&buffer));
//     let array = into_js_array(slice);
//     gl.buffer_data_with_array_buffer_view(buffer_type_, &array, draw_type_);

//     Ok(buffer)
// }
