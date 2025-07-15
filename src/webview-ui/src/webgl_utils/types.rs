use anyhow::{anyhow, Result};
use enum_dispatch::enum_dispatch;
use std::collections::HashMap;

use std::mem;

use std::ops::Deref;

use wasm_bindgen::{JsCast, JsValue};
use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::attributes::IntoJsArray;
pub(crate) use super::constants::*;

pub(crate) type GLConstant = u32;

#[allow(dead_code)]
pub(crate) trait GLValue: GLVerifyType + GLSet {}
impl<T> GLValue for T where T: GLVerifyType + GLSet {}

#[derive(Debug)]
#[enum_dispatch(GLVerifyType, GLSet)]
pub(crate) enum UniformValue<'a> {
    Int(&'a i32),
    Int_(i32),
    Float(&'a f32),
    Float_(f32),
    Bool(&'a bool),
    Bool_(bool),
    Texture(&'a WebGlTexture),

    Vec2(&'a glam::Vec2),
    Vec2_(glam::Vec2),
    Vec3(&'a glam::Vec3),
    Vec3_(glam::Vec3),
    Vec4(&'a glam::Vec4),
    Vec4_(glam::Vec4),
    Mat3(&'a glam::Mat3),
    Mat3_(glam::Mat3),
    Mat4(&'a glam::Mat4),
    Mat4_(glam::Mat4),
}

pub(crate) type UniformSetter = Box<dyn Fn(&GL, &UniformValue)>;
pub(crate) type AttributeSetterFunction = Box<dyn Fn(&GL, &AttribInfo, &dyn GLBuffer)>;

#[allow(dead_code)]
pub(crate) struct AttributeSetter {
    pub index: u32,
    pub setter: AttributeSetterFunction,
}

pub(crate) type AttributeSetterBuilder = fn(u32) -> AttributeSetter;

pub(crate) trait ElementTypeFor {
    const ELEMENT_TYPE: ElementType;
}

impl ElementTypeFor for f32 {
    const ELEMENT_TYPE: ElementType = ElementType::Float;
}

impl ElementTypeFor for u8 {
    const ELEMENT_TYPE: ElementType = ElementType::UnsignedByte;
}

impl ElementTypeFor for u16 {
    const ELEMENT_TYPE: ElementType = ElementType::UnsignedShort;
}

impl<T: ElementTypeFor> ElementTypeFor for &[T] {
    const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
}

impl<T: ElementTypeFor, const N: usize> ElementTypeFor for &[T; N] {
    const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
}

impl<T: ElementTypeFor> ElementTypeFor for Vec<T> {
    const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
}

pub(crate) struct ArraySpec<T: IntoJsArray> {
    pub num_components: usize,
    pub name: String,
    pub data: T,
    pub normalized: bool,
    pub stride: Option<i32>,
    pub target: BindingPoint,
}

pub(crate) trait GLBuffer {
    fn bind(&self, gl: &GL, target: BindingPoint);
}

impl GLBuffer for WebGlBuffer {
    fn bind(&self, gl: &GL, target: BindingPoint) {
        gl.bind_buffer(target as _, Some(self));
    }
}

impl GLBuffer for GLGuard<WebGlBuffer> {
    fn bind(&self, gl: &GL, target: BindingPoint) {
        self.obj.bind(gl, target);
    }
}

pub(crate) struct AttribInfo {
    pub name: String,
    pub num_components: usize,
    pub gl_type: ElementType,
    pub normalized: bool,
    pub stride: i32,
    //  pub offset:
    //  divisor:       array.divisor === undefined ? undefined : array.divisor,
    //  drawType:      array.drawType,
}
pub(crate) struct Attrib<B = GLGuard<WebGlBuffer>>
where
    B: GLBuffer,
{
    pub buffer: B,
    pub info: AttribInfo,
}

pub(crate) struct BufferInfo<B = GLGuard<WebGlBuffer>>
where
    B: GLBuffer,
{
    pub num_elements: usize,
    pub indices: Option<B>,
    pub attribs: Vec<Attrib<B>>,
}

impl<B> BufferInfo<B>
where
    B: GLBuffer,
{
    #[allow(dead_code)]
    pub(crate) fn get_attrib(&self, name: &str) -> Option<&Attrib<B>> {
        self.attribs.iter().find(|attrib| attrib.info.name == name)
    }
    pub(crate) fn get_attrib_mut(&mut self, name: &str) -> Option<&mut Attrib<B>> {
        self.attribs
            .iter_mut()
            .find(|attrib| attrib.info.name == name)
    }
}

pub(crate) struct ProgramBundle {
    pub gl: GL,
    pub program: WebGlProgram,
    pub shaders: Vec<WebGlShader>,
    pub uniform_setters: HashMap<String, UniformSetter>,
    pub attribute_setters: HashMap<String, AttributeSetter>,
}

impl Drop for ProgramBundle {
    fn drop(&mut self) {
        self.program.drop(&self.gl);
        self.shaders.iter().for_each(|shader| shader.drop(&self.gl));
    }
}

#[derive(Debug, Builder)]
#[builder(setter(into, strip_option))]
pub(crate) struct CreateTextureParameters {
    #[builder(default)]
    pub mag_filter: Option<TextureMagFilter>,
    #[builder(default)]
    pub min_filter: Option<TextureMinFilter>,
    #[builder(default)]
    pub wrap_s: Option<TextureWrap>,
    #[builder(default)]
    pub wrap_t: Option<TextureWrap>,
}

pub(crate) trait GLDrop {
    fn drop(&self, gl: &GL);
}

impl<T: GLDrop> GLDrop for Option<T> {
    fn drop(&self, gl: &GL) {
        if let Some(obj) = self {
            obj.drop(gl);
        }
    }
}

impl<T: GLDrop> GLDrop for Vec<T> {
    fn drop(&self, gl: &GL) {
        self.iter().for_each(|obj| obj.drop(gl));
    }
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

impl GLDrop for WebGlTexture {
    fn drop(&self, gl: &GL) {
        gl.delete_texture(Some(self));
    }
}

pub(crate) struct GLGuard<T: GLDrop> {
    pub gl: GL,
    pub obj: T,
}

impl<T: core::fmt::Debug + GLDrop> core::fmt::Debug for GLGuard<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GLGuard").field("obj", &self.obj).finish()
    }
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

pub(crate) fn gl_guarded<T: GLDrop, E>(
    gl: GL,
    f: impl FnOnce(&GL) -> Result<T, E>,
) -> Result<GLGuard<T>, E> {
    f(&gl).map(move |obj| GLGuard { gl, obj })
}

pub(crate) fn take_into_owned<T: GLDrop + JsCast>(mut guard: GLGuard<T>) -> T {
    mem::replace(&mut guard.obj, JsCast::unchecked_into(JsValue::UNDEFINED))
}

// #[enum_dispatch]
#[allow(dead_code)]
pub(crate) trait GLSet {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation);
}

impl GLSet for &i32 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform1i(Some(location), **self);
    }
}

impl GLSet for &f32 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform1f(Some(location), **self);
    }
}

impl GLSet for &bool {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform1i(Some(location), **self as i32);
    }
}

impl GLSet for &glam::Vec2 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform2fv_with_f32_array(Some(location), self.as_ref());
    }
}

impl GLSet for &glam::Vec3 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform3fv_with_f32_array(Some(location), self.as_ref());
    }
}

impl GLSet for &glam::Vec4 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform4fv_with_f32_array(Some(location), self.as_ref());
    }
}

impl GLSet for &glam::Mat3 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform_matrix3fv_with_f32_array(Some(location), false, self.to_cols_array().as_slice());
    }
}

impl GLSet for &glam::Mat4 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) {
        gl.uniform_matrix4fv_with_f32_array(Some(location), false, self.to_cols_array().as_slice());
    }
}

// #[enum_dispatch]

#[allow(dead_code)]
pub(crate) trait GLVerifyType {
    fn verify(&self, expected_type: GLConstant) -> Result<()>;
}

fn impl_gl_verify_type(actual_gl_type: GLConstant, expected_gl_type: GLConstant) -> Result<()> {
    if expected_gl_type != actual_gl_type {
        Err(anyhow!(
            "expected type in shader: {}, actual type: {}",
            GL_CONSTANT_NAMES
                .get(&expected_gl_type)
                .unwrap_or(&"unknown"),
            GL_CONSTANT_NAMES.get(&actual_gl_type).unwrap_or(&"unknown")
        ))
    } else {
        Ok(())
    }
}

impl GLVerifyType for &i32 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::INT, gl_type)
    }
}

impl GLVerifyType for &f32 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT, gl_type)
    }
}

impl GLVerifyType for &bool {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::BOOL, gl_type)
    }
}

impl GLVerifyType for &WebGlTexture {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::SAMPLER_2D, gl_type)
    }
}

impl GLVerifyType for &glam::Vec2 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_VEC2, gl_type)
    }
}

impl GLVerifyType for &glam::Vec3 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_VEC3, gl_type)
    }
}

impl GLVerifyType for &glam::Vec4 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_VEC4, gl_type)
    }
}

impl GLVerifyType for &glam::Mat3 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_MAT3, gl_type)
    }
}

impl GLVerifyType for &glam::Mat4 {
    fn verify(&self, gl_type: GLConstant) -> Result<()> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_MAT4, gl_type)
    }
}
