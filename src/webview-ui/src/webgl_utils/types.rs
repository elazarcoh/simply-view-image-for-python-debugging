use std::borrow::Cow;
use std::collections::HashMap;
use std::convert::TryFrom;
use std::mem;

use std::ops::Deref;

use wasm_bindgen::{JsCast, JsValue};
use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::attributes::IntoJsArray;
use super::constants::GL_CONSTANT_NAMES;

pub type GLConstant = u32;

pub type UniformSetter = Box<dyn Fn(&GL, &dyn GLValue)>;

pub struct AttributeSetter {
    pub index: u32,
    pub setter: Box<dyn Fn(&GL, &AttribInfo)>,
}

pub type AttributeSetterBuilder = fn(u32) -> AttributeSetter;

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum ElementType {
    Int = GL::INT,
    IntVec2 = GL::INT_VEC2,
    IntVec3 = GL::INT_VEC3,
    IntVec4 = GL::INT_VEC4,
    UnsignedInt = GL::UNSIGNED_INT,
    UnsignedIntVec2 = GL::UNSIGNED_INT_VEC2,
    UnsignedIntVec3 = GL::UNSIGNED_INT_VEC3,
    UnsignedIntVec4 = GL::UNSIGNED_INT_VEC4,
    Float = GL::FLOAT,
    FloatVec2 = GL::FLOAT_VEC2,
    FloatVec3 = GL::FLOAT_VEC3,
    FloatVec4 = GL::FLOAT_VEC4,
    Bool = GL::BOOL,
    BoolVec2 = GL::BOOL_VEC2,
    BoolVec3 = GL::BOOL_VEC3,
    BoolVec4 = GL::BOOL_VEC4,
}

impl TryFrom<GLConstant> for ElementType {
    type Error = String;

    fn try_from(value: GLConstant) -> Result<Self, Self::Error> {
        match value {
            GL::FLOAT => Ok(ElementType::Float),
            GL::FLOAT_VEC2 => Ok(ElementType::FloatVec2),
            GL::FLOAT_VEC3 => Ok(ElementType::FloatVec3),
            GL::FLOAT_VEC4 => Ok(ElementType::FloatVec4),
            GL::INT => Ok(ElementType::Int),
            GL::INT_VEC2 => Ok(ElementType::IntVec2),
            GL::INT_VEC3 => Ok(ElementType::IntVec3),
            GL::INT_VEC4 => Ok(ElementType::IntVec4),
            GL::UNSIGNED_INT => Ok(ElementType::UnsignedInt),
            GL::UNSIGNED_INT_VEC2 => Ok(ElementType::UnsignedIntVec2),
            GL::UNSIGNED_INT_VEC3 => Ok(ElementType::UnsignedIntVec3),
            GL::UNSIGNED_INT_VEC4 => Ok(ElementType::UnsignedIntVec4),
            GL::BOOL => Ok(ElementType::Bool),
            GL::BOOL_VEC2 => Ok(ElementType::BoolVec2),
            GL::BOOL_VEC3 => Ok(ElementType::BoolVec3),
            GL::BOOL_VEC4 => Ok(ElementType::BoolVec4),
            _ => Err(format!("unknown element type: {}", value)),
        }
    }
}

impl Into<GLConstant> for ElementType {
    fn into(self) -> GLConstant {
        self as GLConstant
    }
}

pub trait ElementTypeFor {
    const ELEMENT_TYPE: ElementType;
}

impl ElementTypeFor for f32 {
    const ELEMENT_TYPE: ElementType = ElementType::Float;
}

impl<T: ElementTypeFor> ElementTypeFor for &[T] {
    const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
}

impl<T: ElementTypeFor> ElementTypeFor for Vec<T> {
    const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
}

pub enum ArrayData<T> {
    Slice(T),
    // Buffer(WebGlBuffer),
}

pub struct ArraySpec<T: IntoJsArray> {
    pub num_components: usize,
    pub name: String,
    pub data: ArrayData<T>,
    pub normalized: bool,
    pub stride: Option<i32>,
}

pub struct AttribInfo {
    pub name: String,
    pub num_components: usize,
    pub buffer: WebGlBuffer,
    pub gl_type: ElementType,
    pub normalized: bool,
    pub stride: i32,
    //  pub offset:
    //  divisor:       array.divisor === undefined ? undefined : array.divisor,
    //  drawType:      array.drawType,
}

pub struct BufferInfo {
    num_elements: usize,
    element_type: ElementType,
    indices: Option<WebGlBuffer>,
    attribs: HashMap<String, AttribInfo>,
}

pub struct ProgramBundle {
    pub program: WebGlProgram,
    pub shaders: Vec<WebGlShader>,
    pub uniform_setters: HashMap<String, UniformSetter>,
    pub attribute_setters: HashMap<String, AttributeSetter>,
}

pub trait GLDrop {
    fn drop(&self, gl: &GL);
}

impl GLDrop for WebGlProgram {
    fn drop(&self, gl: &GL) {
        gl.delete_program(Some(self));
    }
}

impl GLDrop for WebGlShader {
    fn drop(&self, gl: &GL) {
        gl.delete_shader(Some(self));
    }
}

impl GLDrop for WebGlBuffer {
    fn drop(&self, gl: &GL) {
        gl.delete_buffer(Some(self));
    }
}

impl GLDrop for ProgramBundle {
    fn drop(&self, gl: &GL) {
        self.program.drop(gl);
        self.shaders.iter().for_each(|shader| shader.drop(gl));
    }
}

pub struct GLGuard<T: GLDrop> {
    pub gl: GL,
    pub obj: T,
}

impl<T: GLDrop> Drop for GLGuard<T> {
    fn drop(&mut self) {
        self.obj.drop(&self.gl);
    }
}

impl<T: GLDrop> Deref for GLGuard<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.obj
    }
}

pub fn gl_guarded<T: GLDrop, E>(
    gl: GL,
    f: impl FnOnce(&GL) -> Result<T, E>,
) -> Result<GLGuard<T>, E> {
    f(&gl).map(move |obj| GLGuard { gl, obj })
}

pub fn take_into_owned<T: GLDrop + JsCast>(mut guard: GLGuard<T>) -> T {
    mem::replace(&mut guard.obj, JsCast::unchecked_into(JsValue::UNDEFINED))
}

pub trait GLSet {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> ();
}

impl GLSet for f32 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform1f(Some(location), *self);
    }
}

pub trait GLVerifyType {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String>;
}

pub trait GLValue: GLVerifyType + GLSet {}
impl<T> GLValue for T where T: GLVerifyType + GLSet {}

fn impl_gl_verify_type<T: GLVerifyType>(
    expected_gl_type: GLConstant,
    actual_gl_type: GLConstant,
) -> Result<(), String> {
    if expected_gl_type != actual_gl_type {
        Err(format!(
            "expected type: {}, actual type: {}",
            GL_CONSTANT_NAMES
                .get(&expected_gl_type)
                .unwrap_or(&"unknown"),
            GL_CONSTANT_NAMES.get(&actual_gl_type).unwrap_or(&"unknown")
        ))
    } else {
        Ok(())
    }
}

impl GLVerifyType for f32 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type::<f32>(WebGl2RenderingContext::FLOAT, gl_type)
    }
}
