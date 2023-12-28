use anyhow::{Result, anyhow};

use super::{error::WebGlError, types::*};

use web_sys::{WebGl2RenderingContext as GL, WebGlBuffer};
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
pub(crate) trait IntoJsArray {
    type JsArray: AsRef<js_sys::Object>;
    fn into_js_array(self) -> Self::JsArray;
}

impl<'a> IntoJsArray for &'a [f32] {
    type JsArray = js_sys::Float32Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Float32Array::from(self)
    }
}

impl<'a> IntoJsArray for &'a [u8] {
    type JsArray = js_sys::Uint8Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Uint8Array::from(self)
    }
}

impl<'a> IntoJsArray for &'a [u16] {
    type JsArray = js_sys::Uint16Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Uint16Array::from(self)
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

impl<'a, T: 'a> IntoJsArray for &'a Vec<T>
where
    &'a [T]: IntoJsArray,
{
    type JsArray = <&'a [T] as IntoJsArray>::JsArray;
    fn into_js_array(self) -> Self::JsArray {
        self.as_slice().into_js_array()
    }
}

impl IntoJsArray for Vec<f32> {
    type JsArray = js_sys::Float32Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Float32Array::from(self.as_slice())
    }
}

impl IntoJsArray for Vec<u8> {
    type JsArray = js_sys::Uint8Array;
    fn into_js_array(self) -> Self::JsArray {
        js_sys::Uint8Array::from(self.as_slice())
    }
}

pub(crate) fn create_buffer_from_data<T: IntoJsArray>(
    gl: &GL,
    data: T,
    buffer_type: BindingPoint,
    draw_type: Option<GLConstant>,
) -> Result<GLGuard<WebGlBuffer>> {
    let buffer = gl_guarded(gl.clone(), |gl| {
        gl.create_buffer()
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "create_buffer"))
    })?;
    let draw_type_ = draw_type.unwrap_or(GL::STATIC_DRAW);
    gl.bind_buffer(buffer_type as GLConstant, Some(&buffer));
    let array = data.into_js_array();
    gl.buffer_data_with_array_buffer_view(buffer_type as GLConstant, array.as_ref(), draw_type_);
    gl.bind_buffer(buffer_type as GLConstant, None);
    Ok(buffer)
}

pub(crate) fn create_attributes_from_array<T>(gl: &GL, array: ArraySpec<T>) -> Result<Attrib>
where
    T: IntoJsArray + ElementTypeFor,
{
    let attrib_name = array.name;
    let buffer = create_buffer_from_data(gl, array.data, array.target, None)?;
    let gl_type = T::ELEMENT_TYPE;
    let num_components = array.num_components;
    let normalized = array.normalized;
    let stride = array.stride.unwrap_or(0);

    Ok(Attrib {
        buffer,
        info: AttribInfo {
            name: attrib_name,
            num_components,
            gl_type,
            normalized,
            stride,
        },
    })
}

pub(crate) struct Arrays<TF32, TU8>
where
    TF32: IntoJsArray,
    TU8: IntoJsArray,
{
    pub f32_arrays: Vec<ArraySpec<TF32>>,
    pub u8_arrays: Vec<ArraySpec<TU8>>,
}

/**
  Heuristically guess the number of elements based on the length of the arrays
*/
fn num_elements_from_attributes(gl: &GL, attribs: &[Attrib]) -> Result<usize> {
    let attrib = &attribs[0];
    gl.bind_buffer(GL::ARRAY_BUFFER, Some(&attrib.buffer));
    let num_bytes = gl
        .get_buffer_parameter(GL::ARRAY_BUFFER, GL::BUFFER_SIZE)
        .as_f64()
        .unwrap() as usize;
    gl.bind_buffer(GL::ARRAY_BUFFER, None);

    let bytes_per_element = BYTES_FOR_ELEMENT_TYPE.get(&attrib.info.gl_type).unwrap();
    let total_elements = num_bytes / bytes_per_element;
    let num_elements = total_elements as f32 / attrib.info.num_components as f32;
    // check if integer, if so return total elements
    if num_elements.floor() == num_elements {
        Ok(num_elements as usize)
    } else {
        Err(anyhow!(
            "Got non-integer number of elements. bytes_per_element: {}, num_bytes: {}, num_elements: {}",
            bytes_per_element, num_bytes, num_elements
        ))
    }
}

pub(crate) fn create_buffer_info_from_arrays<TF32, TU8>(
    gl: &GL,
    arrays: Arrays<TF32, TU8>,
    indices: Option<ArraySpec<&[u16]>>,
) -> Result<BufferInfo>
where
    TF32: IntoJsArray + ElementTypeFor,
    TU8: IntoJsArray + ElementTypeFor,
{
    let mut attribs = vec![];
    let mut indices_buffer: Option<GLGuard<WebGlBuffer>> = None;
    let num_elements;
    for array in arrays.f32_arrays {
        attribs.push(create_attributes_from_array(gl, array)?);
    }
    for array in arrays.u8_arrays {
        attribs.push(create_attributes_from_array(gl, array)?);
    }
    if let Some(indices) = indices {
        let buffer = create_buffer_from_data(gl, indices.data, indices.target, None).unwrap();
        indices_buffer = Some(buffer);
        num_elements = indices.data.len();
    } else {
        num_elements = num_elements_from_attributes(gl, &attribs)?;
    }
    Ok(BufferInfo {
        num_elements,
        attribs,
        indices: indices_buffer,
    })
}
