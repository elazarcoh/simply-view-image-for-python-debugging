use do_notation::m;
use std::convert::TryFrom;
use std::mem;

use std::collections::HashMap;
use std::ops::Deref;

use web_sys::*;
use web_sys::{WebGl2RenderingContext as GL, WebGl2RenderingContext};

use super::types::*;

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum ElementType {
    Byte = GL::BYTE,
    UnsignedByte = GL::UNSIGNED_BYTE,
    Short = GL::SHORT,
    UnsignedShort = GL::UNSIGNED_SHORT,
    Int = GL::INT,
    UnsignedInt = GL::UNSIGNED_INT,
    Float = GL::FLOAT,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum GLPrimitive {
    Float = GL::FLOAT,
    FloatVec2 = GL::FLOAT_VEC2,
    FloatVec3 = GL::FLOAT_VEC3,
    FloatVec4 = GL::FLOAT_VEC4,
}

impl TryFrom<GLConstant> for GLPrimitive {
    type Error = String;

    fn try_from(value: GLConstant) -> Result<Self, Self::Error> {
        match value {
            GL::FLOAT => Ok(GLPrimitive::Float),
            GL::FLOAT_VEC2 => Ok(GLPrimitive::FloatVec2),
            GL::FLOAT_VEC3 => Ok(GLPrimitive::FloatVec3),
            GL::FLOAT_VEC4 => Ok(GLPrimitive::FloatVec4),
            _ => Err(format!("unknown element type: {}", value)),
        }
    }
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum TextureMagFilter {
    Nearest = GL::NEAREST,
    Linear = GL::LINEAR,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum TextureMinFilter {
    Nearest = GL::NEAREST,
    Linear = GL::LINEAR,
    NearestMipmapNearest = GL::NEAREST_MIPMAP_NEAREST,
    LinearMipmapNearest = GL::LINEAR_MIPMAP_NEAREST,
    NearestMipmapLinear = GL::NEAREST_MIPMAP_LINEAR,
    LinearMipmapLinear = GL::LINEAR_MIPMAP_LINEAR,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum TextureWrap {
    ClampToEdge = GL::CLAMP_TO_EDGE,
    MirroredRepeat = GL::MIRRORED_REPEAT,
    Repeat = GL::REPEAT,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum BindingPoint {
    ArrayBuffer = GL::ARRAY_BUFFER,
    ElementArrayBuffer = GL::ELEMENT_ARRAY_BUFFER,
    UniformBuffer = GL::UNIFORM_BUFFER,
    CopyReadBuffer = GL::COPY_READ_BUFFER,
    CopyWriteBuffer = GL::COPY_WRITE_BUFFER,
    PixelPackBuffer = GL::PIXEL_PACK_BUFFER,
    PixelUnpackBuffer = GL::PIXEL_UNPACK_BUFFER,
    TransformFeedbackBuffer = GL::TRANSFORM_FEEDBACK_BUFFER,
}

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
                attr.gl_type as GLConstant,
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
    pub static ref GL_ATTRIBUTE_SETTER_FOR_TYPE: HashMap<GLPrimitive, AttributeSetterBuilder> = {
        let mut m = HashMap::<GLPrimitive, AttributeSetterBuilder>::new();

        m.insert(GLPrimitive::Float, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec2, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec3, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec4, float_attribute_setter);

        m
    };
}
