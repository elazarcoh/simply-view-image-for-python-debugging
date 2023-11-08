use enum_dispatch::enum_dispatch;
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

pub trait GLValue: GLVerifyType + GLSet {}
impl<T> GLValue for T where T: GLVerifyType + GLSet {}

#[enum_dispatch(GLVerifyType, GLSet)]
pub enum UniformValue<'a> {
    Float(&'a f32),
    Texture(&'a WebGlTexture),

    Vec2(&'a glam::Vec2),
    Vec3(&'a glam::Vec3),
    Vec4(&'a glam::Vec4),
    Mat3(&'a glam::Mat3),
    Mat4(&'a glam::Mat4),
}

pub type UniformSetter = Box<dyn Fn(&GL, &dyn GLValue)>;

pub struct AttributeSetter {
    pub index: u32,
    pub setter: Box<dyn Fn(&GL, &AttribInfo)>,
}

pub type AttributeSetterBuilder = fn(u32) -> AttributeSetter;

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

impl Into<GLConstant> for ElementType {
    fn into(self) -> GLConstant {
        self as GLConstant
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
    pub buffer: GLGuard<WebGlBuffer>,
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
pub struct CreateTextureParameters {
    #[builder(default)]
    pub mag_filter: Option<TextureMagFilter>,
    #[builder(default)]
    pub min_filter: Option<TextureMinFilter>,
    #[builder(default)]
    pub wrap_s: Option<TextureWrap>,
    #[builder(default)]
    pub wrap_t: Option<TextureWrap>,
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

impl GLDrop for WebGlTexture {
    fn drop(&self, gl: &GL) {
        gl.delete_texture(Some(self));
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

#[enum_dispatch]
pub trait GLSet {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> ();
}

impl GLSet for &f32 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform1f(Some(location), **self);
    }
}

impl GLSet for &WebGlTexture {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        let texture_unit = 0;
        gl.uniform1i(Some(location), texture_unit); // TODO: need to fine the texture unit
        gl.active_texture(GL::TEXTURE0 + texture_unit as u32);
        gl.bind_texture(GL::TEXTURE_2D, Some(self));
        // TODO: maybe need to bindSampler
    }
}

impl GLSet for &glam::Vec2 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform2fv_with_f32_array(Some(location), self.as_ref());
    }
}

impl GLSet for &glam::Vec3 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform3fv_with_f32_array(Some(location), self.as_ref());
    }
}

impl GLSet for &glam::Vec4 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform4fv_with_f32_array(Some(location), self.as_ref());
    }
}

impl GLSet for &glam::Mat3 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform_matrix3fv_with_f32_array(Some(location), false, self.to_cols_array().as_slice());
    }
}

impl GLSet for &glam::Mat4 {
    fn set(&self, gl: &GL, location: &WebGlUniformLocation) -> () {
        gl.uniform_matrix4fv_with_f32_array(Some(location), false, self.to_cols_array().as_slice());
    }
}

#[enum_dispatch]
pub trait GLVerifyType {
    fn verify(&self, expected_type: GLConstant) -> Result<(), String>;
}

fn impl_gl_verify_type(
    actual_gl_type: GLConstant,
    expected_gl_type: GLConstant,
) -> Result<(), String> {
    if expected_gl_type != actual_gl_type {
        Err(format!(
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

impl GLVerifyType for &f32 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT, gl_type)
    }
}

impl GLVerifyType for &WebGlTexture {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::SAMPLER_2D, gl_type)
    }
}

impl GLVerifyType for &glam::Vec2 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_VEC2, gl_type)
    }
}

impl GLVerifyType for &glam::Vec3 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_VEC3, gl_type)
    }
}

impl GLVerifyType for &glam::Vec4 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_VEC4, gl_type)
    }
}

impl GLVerifyType for &glam::Mat3 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_MAT3, gl_type)
    }
}

impl GLVerifyType for &glam::Mat4 {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String> {
        impl_gl_verify_type(WebGl2RenderingContext::FLOAT_MAT4, gl_type)
    }
}




// image crate integration
cfg_if! {
    if #[cfg(feature = "image")]
    {
    use image;

    impl<T: ElementTypeFor> ElementTypeFor for image::Rgb<T> {
        const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
    }
    impl<T: ElementTypeFor> ElementTypeFor for image::Rgba<T> {
        const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
    }
    impl<T: ElementTypeFor> ElementTypeFor for image::Luma<T> {
        const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
    }
    impl<T: ElementTypeFor> ElementTypeFor for image::LumaA<T> {
        const ELEMENT_TYPE: ElementType = T::ELEMENT_TYPE;
    }

    pub fn element_type_for_dynamic_image(img: &image::DynamicImage) -> ElementType {
        match img {
            image::DynamicImage::ImageLuma8(_) => ElementType::UnsignedByte,
            image::DynamicImage::ImageLumaA8(_) => ElementType::UnsignedByte,
            image::DynamicImage::ImageRgb8(_) => ElementType::UnsignedByte,
            image::DynamicImage::ImageRgba8(_) => ElementType::UnsignedByte,
            image::DynamicImage::ImageLuma16(_) => ElementType::UnsignedShort,
            image::DynamicImage::ImageLumaA16(_) => ElementType::UnsignedShort,
            image::DynamicImage::ImageRgb16(_) => ElementType::UnsignedShort,
            image::DynamicImage::ImageRgba16(_) => ElementType::UnsignedShort,
            image::DynamicImage::ImageRgb32F(_) => ElementType::Float,
            image::DynamicImage::ImageRgba32F(_) => ElementType::Float,
            _ => unimplemented!(),
        }
    }

    }
}
