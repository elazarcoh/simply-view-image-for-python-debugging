use do_notation::m;
use std::mem;

use std::collections::HashMap;
use std::ops::Deref;

use web_sys::*;
use web_sys::{WebGl2RenderingContext as GL, WebGl2RenderingContext};

use super::types::*;

lazy_static! {
    // to_string for gl constants
    pub static ref GL_CONSTANT_NAMES: HashMap<GLConstant, &'static str> = {
        let mut m = HashMap::new();
        m.insert(WebGl2RenderingContext::FLOAT, "FLOAT");
        m.insert(WebGl2RenderingContext::FLOAT_VEC2, "FLOAT_VEC2");
        m.insert(WebGl2RenderingContext::FLOAT_VEC3, "FLOAT_VEC3");
        m.insert(WebGl2RenderingContext::FLOAT_VEC4, "FLOAT_VEC4");
        m.insert(WebGl2RenderingContext::INT, "INT");
        m.insert(WebGl2RenderingContext::INT_VEC2, "INT_VEC2");
        m.insert(WebGl2RenderingContext::INT_VEC3, "INT_VEC3");
        m.insert(WebGl2RenderingContext::INT_VEC4, "INT_VEC4");
        m.insert(WebGl2RenderingContext::UNSIGNED_INT, "UNSIGNED_INT");
        m.insert(WebGl2RenderingContext::UNSIGNED_INT_VEC2, "UNSIGNED_INT_VEC2");
        m.insert(WebGl2RenderingContext::UNSIGNED_INT_VEC3, "UNSIGNED_INT_VEC3");
        m.insert(WebGl2RenderingContext::UNSIGNED_INT_VEC4, "UNSIGNED_INT_VEC4");
        m.insert(WebGl2RenderingContext::BOOL, "BOOL");
        m.insert(WebGl2RenderingContext::BOOL_VEC2, "BOOL_VEC2");
        m.insert(WebGl2RenderingContext::BOOL_VEC3, "BOOL_VEC3");
        m.insert(WebGl2RenderingContext::BOOL_VEC4, "BOOL_VEC4");
        m.insert(WebGl2RenderingContext::FLOAT_MAT2, "FLOAT_MAT2");
        m.insert(WebGl2RenderingContext::FLOAT_MAT3, "FLOAT_MAT3");
        m.insert(WebGl2RenderingContext::FLOAT_MAT4, "FLOAT_MAT4");
        m.insert(WebGl2RenderingContext::SAMPLER_2D, "SAMPLER_2D");
        m.insert(WebGl2RenderingContext::SAMPLER_CUBE, "SAMPLER_CUBE");

        m // return
    };
}

fn float_attribute_setter(index: u32) -> AttributeSetter {
    AttributeSetter {
        index,
        setter: Box::new(move |gl: &GL, attr: &AttribInfo| {
            gl.bind_buffer(GL::ARRAY_BUFFER, Some(&attr.buffer));
            gl.enable_vertex_attrib_array(index);
            gl.vertex_attrib_pointer_with_i32(
                index,
                attr.num_components as i32,
                attr.gl_type.into(),
                attr.normalized,
                attr.stride,
                0,
            );
        }),
    }
}

fn int_attribute_setter(gl: &GL, index: u32) {}

fn uint_attribute_setter(gl: &GL, index: u32) {}

lazy_static! {
    pub static ref GL_ATTRIBUTE_SETTER_FOR_TYPE: HashMap<ElementType, AttributeSetterBuilder> = {
        let mut m = HashMap::<ElementType, AttributeSetterBuilder>::new();

        m.insert(ElementType::Float, float_attribute_setter);
        m.insert(ElementType::FloatVec2, float_attribute_setter);
        m.insert(ElementType::FloatVec3, float_attribute_setter);
        m.insert(ElementType::FloatVec4, float_attribute_setter);

        m
    };
}
