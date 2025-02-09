use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::convert::TryInto;

use wasm_bindgen::JsCast;
use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::constants::GL_ATTRIBUTE_SETTER_FOR_TYPE;
use super::error::WebGlError;
use super::types::*;

fn check_shader_status(gl: &GL, shader_type: GLConstant, shader: &WebGlShader) -> Result<()> {
    // Check the compile status
    let compiled = gl.get_shader_parameter(shader, GL::COMPILE_STATUS);
    if !compiled {
        let shader_type_str = match shader_type {
            GL::VERTEX_SHADER => "vertex",
            GL::FRAGMENT_SHADER => "fragment",
            _ => "unknown",
        };
        // Something went wrong during compilation; get the error
        let last_error = gl.get_shader_info_log(shader);
        let shader_source = gl.get_shader_source(shader);
        Err(anyhow!(
            "Error compiling `{}` shader: {}\nsource:\n{}",
            shader_type_str,
            last_error.unwrap_or("unknown error".to_string()),
            shader_source.unwrap_or("unknown source".to_string())
        ))
    } else {
        Ok(())
    }
}

fn validate_program(gl: &GL, program: &WebGlProgram) -> Result<()> {
    // Check the link status
    gl.validate_program(program);

    let linked = gl
        .get_program_parameter(program, GL::LINK_STATUS)
        .as_bool()
        .unwrap();

    if !linked {
        let last_error = gl.get_program_info_log(program);
        let errors = gl
            .get_attached_shaders(program)
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "get_attached_shaders"))?
            .iter()
            .map(|shader| {
                let shader: &WebGlShader = shader.dyn_ref::<WebGlShader>().unwrap();
                check_shader_status(
                    gl,
                    gl.get_shader_parameter(shader, GL::SHADER_TYPE)
                        .as_f64()
                        .unwrap() as GLConstant,
                    shader,
                )
            })
            .filter(|result| result.is_err())
            .map(|result| result.unwrap_err())
            .collect::<Vec<_>>();

        Err(anyhow!(
            "{}\n{}",
            last_error.unwrap_or("unknown error".to_string()),
            errors
                .iter()
                .map(|error| error.to_string())
                .collect::<Vec<_>>()
                .join("\n")
        ))
    } else {
        Ok(())
    }
}

fn make_uniform_setter(gl_type: GLConstant, location: WebGlUniformLocation) -> UniformSetter {
    let _ = gl_type;
    Box::new(move |gl: &GL, value: &UniformValue| match value {
        UniformValue::Int(v) => gl.uniform1i(Some(&location), **v),
        UniformValue::Float(v) => gl.uniform1f(Some(&location), **v),
        UniformValue::Bool(v) => gl.uniform1i(Some(&location), **v as i32),
        UniformValue::Vec2(v) => gl.uniform2fv_with_f32_array(Some(&location), v.as_ref()),
        UniformValue::Vec3(v) => gl.uniform3fv_with_f32_array(Some(&location), v.as_ref()),
        UniformValue::Vec4(v) => gl.uniform4fv_with_f32_array(Some(&location), v.as_ref()),
        UniformValue::Mat3(v) => gl.uniform_matrix3fv_with_f32_array(
            Some(&location),
            false,
            v.to_cols_array().as_slice(),
        ),
        UniformValue::Mat4(v) => gl.uniform_matrix4fv_with_f32_array(
            Some(&location),
            false,
            v.to_cols_array().as_slice(),
        ),
        UniformValue::Texture(_) => panic!("Texture should be handled separately"),
    })
}

fn make_sampler_setter(
    gl_type: GLConstant,
    texture_unit: i32,
    location: WebGlUniformLocation,
) -> UniformSetter {
    let _ = gl_type;
    Box::new(move |gl: &GL, value: &UniformValue| {
        if let UniformValue::Texture(value) = value {
            gl.uniform1i(Some(&location), texture_unit);
            gl.active_texture(GL::TEXTURE0 + texture_unit as u32);
            gl.bind_texture(TextureTarget::Texture2D as _, Some(value));
        } else {
            panic!("Expected texture value");
        }
    })
}

#[allow(dead_code)]
trait GLVerifyType {
    fn verify(&self, gl_type: GLConstant) -> Result<()>;
}
/**
 * Creates setter functions for all uniforms of a shader
 * program.
 *
 * @see {@link module:twgl.setUniforms}
 *
 * @param {WebGLProgram} program the program to create setters for.
 * @returns {Object.<string, function>} an object with a setter by name for each uniform
 * @memberOf module:twgl/programs
 */
fn create_uniform_setters(
    gl: &GL,
    program: &WebGlProgram,
) -> Result<HashMap<String, UniformSetter>> {
    let num_uniforms = gl
        .get_program_parameter(program, GL::ACTIVE_UNIFORMS)
        .as_f64()
        .unwrap() as u32;
    // log::debug!("Num uniforms: {}", num_uniforms);

    let mut uniform_setters: HashMap<String, UniformSetter> = HashMap::new();
    let mut texture_unit = 0;
    for ii in 0..num_uniforms {
        let uniform_info = gl
            .get_active_uniform(program, ii)
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "get_active_uniform"))?;

        let name = uniform_info.name();
        // remove the array suffix.
        // - uniforms end with '[0]'
        let is_array = name.ends_with("[0]");
        let name = if is_array {
            &name[..name.len() - 3]
        } else {
            &name
        };
        let gl_type = uniform_info.type_();
        // log::debug!("Uniform: {} type: {}", name, gl_type);
        if let Some(location) = gl.get_uniform_location(program, uniform_info.name().as_str()) {
            let setter = if [
                GL::SAMPLER_2D,
                GL::SAMPLER_CUBE,
                GL::SAMPLER_3D,
                GL::SAMPLER_2D_ARRAY,
                GL::INT_SAMPLER_2D,
                GL::INT_SAMPLER_3D,
                GL::INT_SAMPLER_CUBE,
                GL::UNSIGNED_INT_SAMPLER_2D,
                GL::UNSIGNED_INT_SAMPLER_3D,
            ]
            .contains(&gl_type)
            {
                let unit = texture_unit;
                // log::debug!("Creating sampler setter for: {} at unit: {}", name, unit);
                texture_unit += uniform_info.size();
                make_sampler_setter(gl_type, unit, location)
            } else {
                make_uniform_setter(gl_type, location)
            };
            uniform_setters.insert(name.to_string(), setter);
        }
    }

    Ok(uniform_setters)
}

fn is_built_in(attrib_info: &WebGlActiveInfo) -> bool {
    let name = attrib_info.name();
    name.starts_with("gl_") || name.starts_with("webgl_")
}

fn create_attributes_setters(
    gl: &GL,
    program: &WebGlProgram,
) -> Result<HashMap<String, AttributeSetter>> {
    let num_attribs = gl
        .get_program_parameter(program, GL::ACTIVE_ATTRIBUTES)
        .as_f64()
        .unwrap() as u32;

    let mut attrib_setters: HashMap<String, AttributeSetter> = HashMap::new();
    for ii in 0..num_attribs {
        let attrib_info = gl
            .get_active_attrib(program, ii)
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "get_active_attrib"))?;

        if is_built_in(&attrib_info) {
            continue;
        }
        let index = gl.get_attrib_location(program, attrib_info.name().as_str());
        let gl_type: Result<GLPrimitive, _> = attrib_info.type_().try_into();
        if let Ok(gl_type) = gl_type {
            if let Some(setter) = GL_ATTRIBUTE_SETTER_FOR_TYPE.get(&gl_type) {
                attrib_setters.insert(attrib_info.name().to_string(), setter(index as _));
            } else {
                log::error!(
                    "Could not find attribute setter for type: {:?}. Required for attribute: {}",
                    gl_type,
                    attrib_info.name()
                );
            }
        }
    }

    Ok(attrib_setters)
}

pub(crate) fn set_uniforms(program: &ProgramBundle, uniforms: &HashMap<&str, UniformValue>) {
    uniforms
        .iter()
        .for_each(|(name, value)| match program.uniform_setters.get(*name) {
            Some(setter) => setter(&program.gl, value),
            None => log::warn!(
                "Could not find uniform setter for: {}. Maybe it is unused?",
                name
            ),
        });
}

pub(crate) fn set_buffers_and_attributes<B>(program: &ProgramBundle, buffer_info: &BufferInfo<B>)
where
    B: GLBuffer,
{
    buffer_info.attribs.iter().for_each(|attrib| {
        if let Some(attr_setter) = program.attribute_setters.get(attrib.info.name.as_str()) {
            (attr_setter.setter)(&program.gl, &attrib.info, &attrib.buffer);
        } else {
            log::warn!(
                "Could not find attribute setter for: {}. Maybe it is unused?",
                attrib.info.name
            );
        }
    });

    if let Some(indices) = &buffer_info.indices {
        let gl = &program.gl;
        indices.bind(gl, BindingPoint::ElementArrayBuffer);
    }
}

pub(crate) fn create_program_bundle(
    gl: &GL,
    vertex_shader: &str,
    fragment_shader: &str,
    opt_attribs: Option<Vec<&str>>,
) -> Result<ProgramBundle> {
    let binding = opt_attribs.unwrap_or_default();
    let attribute_locations = binding.iter().enumerate().collect::<Vec<(usize, &&str)>>();

    let program = gl_guarded(gl.clone(), |gl| {
        gl.create_program()
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "create_program"))
    })?;

    let gl_vertex_shader = gl_guarded(gl.clone(), |gl| {
        gl.create_shader(WebGl2RenderingContext::VERTEX_SHADER)
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "create_shader"))
            .inspect(|shader| {
                gl.shader_source(shader, vertex_shader);
                gl.compile_shader(shader);
                gl.attach_shader(&program, shader);
            })
    })?;

    let gl_fragment_shader = gl_guarded(gl.clone(), |gl| {
        gl.create_shader(WebGl2RenderingContext::FRAGMENT_SHADER)
            .ok_or_else(|| WebGlError::last_webgl_error_or_unknown(gl, "create_shader"))
            .inspect(|shader| {
                gl.shader_source(shader, fragment_shader);
                gl.compile_shader(shader);
                gl.attach_shader(&program, shader);
            })
    })?;

    attribute_locations.iter().for_each(|(i, name)| {
        gl.bind_attrib_location(&program, *i as _, name);
    });

    gl.link_program(&program);

    validate_program(gl, &program)?;

    let uniform_setters = create_uniform_setters(gl, &program)?;

    let attribute_setters = create_attributes_setters(gl, &program)?;

    Ok(ProgramBundle {
        gl: gl.clone(),
        program: take_into_owned(program),
        shaders: vec![
            take_into_owned(gl_vertex_shader),
            take_into_owned(gl_fragment_shader),
        ],
        uniform_setters,
        attribute_setters,
    })
}

#[derive(Debug, Builder)]
#[builder(
    pattern = "owned",
    custom_constructor,
    create_empty = "empty",
    build_fn(
        private,
        name = "fallible_build",
        error = "::derive_builder::UninitializedFieldError"
    )
)]
pub(crate) struct GLProgramBuilder<'a> {
    #[builder(setter(custom))]
    gl: &'a GL,

    vertex_shader: &'a str,
    fragment_shader: &'a str,

    #[builder(setter(each(name = "attribute")))]
    attributes: Vec<&'a str>,
}

impl GLProgramBuilder<'_> {
    pub(crate) fn create(gl: &GL) -> GLProgramBuilderBuilder<'_> {
        GLProgramBuilderBuilder {
            gl: Some(gl),
            ..GLProgramBuilderBuilder::empty()
        }
    }
}

impl GLProgramBuilderBuilder<'_> {
    pub(crate) fn build(self) -> Result<ProgramBundle> {
        self.fallible_build()
            .map_err(|e| anyhow!("GLProgramBuilder error: {}", e))
            .and_then(|b| {
                create_program_bundle(b.gl, b.vertex_shader, b.fragment_shader, Some(b.attributes))
            })
    }
}
