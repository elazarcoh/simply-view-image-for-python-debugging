use std::borrow::Cow;
use std::collections::HashMap;
use std::mem;

use std::ops::Deref;

use wasm_bindgen::{JsCast, JsValue};
use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::constants::GL_CONSTANT_NAMES;

pub type GLConstant = u32;

pub type GLSetter = Box<dyn Fn(&GL, &dyn GLValue)>;

pub struct ProgramBundle {
    pub program: WebGlProgram,
    pub shaders: Vec<WebGlShader>,
    pub uniform_setters: HashMap<String, GLSetter>,
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
