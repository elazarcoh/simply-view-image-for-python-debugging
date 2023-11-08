use super::{constants::*, types::*};

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

impl<'a, T, const N: usize> IntoJsArray for &'a [T; N]
where
    &'a [T]: IntoJsArray,
{
    type JsArray = <&'a [T] as IntoJsArray>::JsArray;
    fn into_js_array(self) -> Self::JsArray {
        self.as_ref().into_js_array()
    }
}

impl IntoJsArray for &[u8] {
    type JsArray = js_sys::Uint8Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Uint8Array::from(self)
    }
}

impl IntoJsArray for &[u16] {
    type JsArray = js_sys::Uint16Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Uint16Array::from(self)
    }
}

pub fn create_buffer_from_data<T: IntoJsArray>(
    gl: &GL,
    data: T,
    buffer_type: BindingPoint,
    draw_type: Option<GLConstant>,
) -> Result<GLGuard<WebGlBuffer>, String> {
    let buffer = gl_guarded(gl.clone(), |gl| {
        gl.create_buffer().ok_or("Could not create buffer")
    })?;
    let draw_type_ = draw_type.unwrap_or(GL::STATIC_DRAW);
    gl.bind_buffer(buffer_type as GLConstant, Some(&buffer));
    let array = data.into_js_array();
    gl.buffer_data_with_array_buffer_view(buffer_type as GLConstant, array.as_ref(), draw_type_);
    gl.bind_buffer(buffer_type as GLConstant, None);
    Ok(buffer)
}

pub fn create_attributes_from_array<T>(gl: &GL, array: ArraySpec<T>) -> Result<AttribInfo, String>
where
    T: IntoJsArray + ElementTypeFor,
{
    let attrib_name = array.name;
    let buffer = create_buffer_from_data(gl, array.data, array.target, None)?;
    let gl_type = T::ELEMENT_TYPE;
    let num_components = array.num_components;
    let normalized = array.normalized;
    let stride = array.stride.unwrap_or(0);

    Ok(AttribInfo {
        name: attrib_name,
        num_components,
        buffer,
        gl_type,
        normalized,
        stride,
    })
}

pub struct Arrays<'a> {
    pub f32_arrays: Vec<ArraySpec<&'a [f32]>>,
    pub u8_arrays: Vec<ArraySpec<&'a [u8]>>,
}

pub fn create_buffer_info_from_arrays(
    gl: &GL,
    arrays: Arrays,
    indices: Option<ArraySpec<&[u16]>>,
) -> Result<BufferInfo, String> {
    let mut attribs = vec![];
    let mut indices_buffer = None;
    for array in arrays.f32_arrays {
        attribs.push(create_attributes_from_array(gl, array)?);
    }
    for array in arrays.u8_arrays {
        attribs.push(create_attributes_from_array(gl, array)?);
    }
    if let Some(indices) = indices {
        let buffer = create_buffer_from_data(gl, indices.data, indices.target, None).unwrap();
        indices_buffer = Some(buffer);
    };
    Ok(BufferInfo {
        attribs,
        indices: indices_buffer,
    })
}
