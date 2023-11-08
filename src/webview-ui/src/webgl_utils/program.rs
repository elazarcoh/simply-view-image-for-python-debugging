use std::borrow::Cow;
use std::collections::HashMap;
use std::convert::TryInto;
use std::ops::Deref;

use wasm_bindgen::JsCast;
use web_sys::WebGl2RenderingContext as GL;
use web_sys::*;

use super::constants::GL_ATTRIBUTE_SETTER_FOR_TYPE;
use super::types::*;

fn check_shader_status(
    gl: &GL,
    shader_type: GLConstant,
    shader: &WebGlShader,
) -> Result<(), String> {
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
        let msg = format!(
            "Error compiling `{}` shader: {}\nsource:\n{}",
            shader_type_str,
            last_error.unwrap_or("unknown error".to_string()),
            shader_source.unwrap_or("unknown source".to_string())
        );
        Err(msg)
    } else {
        Ok(())
    }
}

fn validate_program(gl: &GL, program: &WebGlProgram) -> Result<(), String> {
    // Check the link status
    gl.validate_program(program);

    let linked = gl
        .get_program_parameter(&program, GL::LINK_STATUS)
        .as_bool()
        .unwrap();

    if !linked {
        let last_error = gl.get_program_info_log(program);
        let errors = gl
            .get_attached_shaders(program)
            .ok_or("Could not get attached shaders")?
            .iter()
            .map(|shader| {
                let shader: &WebGlShader = shader.dyn_ref::<WebGlShader>().unwrap();
                check_shader_status(
                    &gl,
                    gl.get_shader_parameter(shader, GL::SHADER_TYPE)
                        .as_f64()
                        .unwrap() as GLConstant,
                    shader,
                )
            })
            .filter(|result| result.is_err())
            .map(|result| result.unwrap_err())
            .collect::<Vec<_>>();

        let message = format!(
            "{}\n{}",
            last_error.unwrap_or("unknown error".to_string()),
            errors
                .iter()
                .map(|error| error.to_string())
                .collect::<Vec<_>>()
                .join("\n")
        );

        Err(message)
    } else {
        Ok(())
    }
}

fn make_uniform_setter(gl_type: GLConstant, location: WebGlUniformLocation) -> UniformSetter {
    Box::new(move |gl: &GL, value: &dyn GLValue| {
        if cfg!(debug_assertions) {
            value.verify(gl_type).unwrap();
        }
        value.set(gl, &location);
    })
}

trait GLVerifyType {
    fn verify(&self, gl_type: GLConstant) -> Result<(), String>;
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
) -> Result<HashMap<String, UniformSetter>, String> {
    let num_uniforms = gl
        .get_program_parameter(program, GL::ACTIVE_UNIFORMS)
        .as_f64()
        .unwrap() as u32;


    let mut uniform_setters: HashMap<String, UniformSetter> = HashMap::new();
    for ii in 0..num_uniforms {
        let uniform_info = gl
            .get_active_uniform(program, ii)
            .ok_or("Could not get uniform info")?;

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
        if let Some(location) = gl.get_uniform_location(program, uniform_info.name().as_str()) {
            let setter = make_uniform_setter(gl_type, location);
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
) -> Result<HashMap<String, AttributeSetter>, String> {
    let num_attribs = gl
        .get_program_parameter(program, GL::ACTIVE_ATTRIBUTES)
        .as_f64()
        .unwrap() as u32;

    let mut attrib_setters: HashMap<String, AttributeSetter> = HashMap::new();
    for ii in 0..num_attribs {
        let attrib_info = gl
            .get_active_attrib(program, ii)
            .ok_or("Could not get active attribute")?;

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
    //   return attribSetters;
}

pub fn set_uniforms(program: &ProgramBundle, uniforms: &HashMap<&str, UniformValue>) {
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

pub fn set_buffers_and_attributes(program: &ProgramBundle, buffer_info: &BufferInfo) {
    buffer_info.attribs.iter().for_each(|(info)| {
        if let Some(attr_setter) = program.attribute_setters.get(info.name.as_str()) {
            (attr_setter.setter)(&program.gl, &info);
        } else {
            log::warn!(
                "Could not find attribute setter for: {}. Maybe it is unused?",
                info.name
            );
        }
    });

    if let Some(indices) = &buffer_info.indices {
        let gl = &program.gl;
        gl.bind_buffer(GL::ELEMENT_ARRAY_BUFFER, Some(&indices));
    }
}

pub fn create_program_bundle(
    gl: &GL,
    vertex_shader: &str,
    fragment_shader: &str,
    opt_attribs: Option<Vec<&str>>,
) -> Result<ProgramBundle, String> {
    let binding = opt_attribs.unwrap_or(vec![]);
    let attribute_locations = binding.iter().enumerate().collect::<Vec<(usize, &&str)>>();

    let program = gl_guarded(gl.clone(), |gl| {
        gl.create_program().ok_or("Could not create program")
    })?;

    let gl_vertex_shader = gl_guarded(gl.clone(), |gl| {
        gl.create_shader(WebGl2RenderingContext::VERTEX_SHADER)
            .ok_or("Could not create vertex shader")
            .map(|shader| {
                gl.shader_source(&shader, vertex_shader);
                gl.compile_shader(&shader);
                gl.attach_shader(&program, &shader);
                shader
            })
    })?;

    let gl_fragment_shader = gl_guarded(gl.clone(), |gl| {
        gl.create_shader(WebGl2RenderingContext::FRAGMENT_SHADER)
            .ok_or("Could not create fragment shader")
            .map(|shader| {
                gl.shader_source(&shader, fragment_shader);
                gl.compile_shader(&shader);
                gl.attach_shader(&program, &shader);
                shader
            })
    })?;

    let bounded_attributes = attribute_locations.iter().for_each(|(i, name)| {
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
pub struct GLProgramBuilder<'a> {
    #[builder(setter(custom))]
    gl: &'a GL,

    vertex_shader: &'a str,
    fragment_shader: &'a str,

    #[builder(setter(each(name = "attribute")))]
    attributes: Vec<&'a str>,
}

impl<'a> GLProgramBuilder<'a> {
    pub fn new<'b>(gl: &'b GL) -> GLProgramBuilderBuilder<'b> {
        GLProgramBuilderBuilder {
            gl: Some(gl),
            ..GLProgramBuilderBuilder::empty()
        }
    }
}

impl<'a> GLProgramBuilderBuilder<'a> {
    pub fn build(self) -> Result<ProgramBundle, String> {
        self.fallible_build()
            .map_err(|e| format!("GLProgramBuilder error: {}", e))
            .and_then(|b| {
                create_program_bundle(b.gl, b.vertex_shader, b.fragment_shader, Some(b.attributes))
            })
    }
}
