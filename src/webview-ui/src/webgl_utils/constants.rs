use std::convert::TryFrom;
use std::mem;

use std::collections::HashMap;

use web_sys::{WebGl2RenderingContext as GL, WebGl2RenderingContext};

use super::{error::WebGlError, types::*};

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum ElementType {
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
pub(crate) enum GLPrimitive {
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
pub(crate) enum Format {
    Red = GL::RED,
    RedInteger = GL::RED_INTEGER,
    RG = GL::RG,
    RgInteger = GL::RG_INTEGER,
    Rgb = GL::RGB,
    RgbInteger = GL::RGB_INTEGER,
    Rgba = GL::RGBA,
    RgbaInteger = GL::RGBA_INTEGER,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum InternalFormat {
    // treated as Gray
    R16F = GL::R16F,
    R32F = GL::R32F,
    R8UI = GL::R8UI,
    R8I = GL::R8I,
    R16UI = GL::R16UI,
    R16I = GL::R16I,
    R32UI = GL::R32UI,
    R32I = GL::R32I,
    // treated as Gray + Alpha
    RG16F = GL::RG16F,
    RG32F = GL::RG32F,
    RG8UI = GL::RG8UI,
    RG8I = GL::RG8I,
    RG16UI = GL::RG16UI,
    RG16I = GL::RG16I,
    RG32UI = GL::RG32UI,
    RG32I = GL::RG32I,
    // treated as RGB
    RGB16F = GL::RGB16F,
    RGB32F = GL::RGB32F,
    RGB8UI = GL::RGB8UI,
    RGB8I = GL::RGB8I,
    RGB16UI = GL::RGB16UI,
    RGB16I = GL::RGB16I,
    RGB32UI = GL::RGB32UI,
    RGB32I = GL::RGB32I,
    // treated as RGBA
    RGBA16F = GL::RGBA16F,
    RGBA32F = GL::RGBA32F,
    RGBA8UI = GL::RGBA8UI,
    RGBA8I = GL::RGBA8I,
    RGBA16UI = GL::RGBA16UI,
    RGBA16I = GL::RGBA16I,
    RGBA32UI = GL::RGBA32UI,
    RGBA32I = GL::RGBA32I,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum TextureTarget {
    Texture2D = GL::TEXTURE_2D,
    TextureCubeMap = GL::TEXTURE_CUBE_MAP,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum TextureMagFilter {
    Nearest = GL::NEAREST,
    Linear = GL::LINEAR,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum TextureMinFilter {
    Nearest = GL::NEAREST,
    Linear = GL::LINEAR,
    NearestMipmapNearest = GL::NEAREST_MIPMAP_NEAREST,
    LinearMipmapNearest = GL::LINEAR_MIPMAP_NEAREST,
    NearestMipmapLinear = GL::NEAREST_MIPMAP_LINEAR,
    LinearMipmapLinear = GL::LINEAR_MIPMAP_LINEAR,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum TextureWrap {
    ClampToEdge = GL::CLAMP_TO_EDGE,
    MirroredRepeat = GL::MIRRORED_REPEAT,
    Repeat = GL::REPEAT,
}

#[allow(clippy::enum_variant_names)]
#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum BindingPoint {
    ArrayBuffer = GL::ARRAY_BUFFER,
    ElementArrayBuffer = GL::ELEMENT_ARRAY_BUFFER,
    UniformBuffer = GL::UNIFORM_BUFFER,
    CopyReadBuffer = GL::COPY_READ_BUFFER,
    CopyWriteBuffer = GL::COPY_WRITE_BUFFER,
    PixelPackBuffer = GL::PIXEL_PACK_BUFFER,
    PixelUnpackBuffer = GL::PIXEL_UNPACK_BUFFER,
    TransformFeedbackBuffer = GL::TRANSFORM_FEEDBACK_BUFFER,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum DrawMode {
    Points = GL::POINTS,
    LineStrip = GL::LINE_STRIP,
    LineLoop = GL::LINE_LOOP,
    Lines = GL::LINES,
    TriangleStrip = GL::TRIANGLE_STRIP,
    TriangleFan = GL::TRIANGLE_FAN,
    Triangles = GL::TRIANGLES,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub(crate) enum Capability {
    DepthTest = GL::DEPTH_TEST,
    StencilTest = GL::STENCIL_TEST,
    Blend = GL::BLEND,
    CullFace = GL::CULL_FACE,
    PolygonOffsetFill = GL::POLYGON_OFFSET_FILL,
    SampleAlphaToCoverage = GL::SAMPLE_ALPHA_TO_COVERAGE,
    SampleCoverage = GL::SAMPLE_COVERAGE,
    ScissorTest = GL::SCISSOR_TEST,
}

lazy_static! {
    // to_string for gl constants
    pub(crate)static ref GL_CONSTANT_NAMES: HashMap<GLConstant, &'static str> = {
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
        setter: Box::new(move |gl: &GL, attr: &AttribInfo, buffer: &dyn GLBuffer| {
            buffer.bind(gl, BindingPoint::ArrayBuffer);
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

fn int_attribute_setter(_gl: &GL, _index: u32) {}

fn uint_attribute_setter(_gl: &GL, _index: u32) {}

lazy_static! {
    pub(crate) static ref GL_ATTRIBUTE_SETTER_FOR_TYPE: HashMap<GLPrimitive, AttributeSetterBuilder> = {
        let mut m = HashMap::<GLPrimitive, AttributeSetterBuilder>::new();

        m.insert(GLPrimitive::Float, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec2, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec3, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec4, float_attribute_setter);

        m
    };
}

lazy_static! {
    pub(crate) static ref BYTES_FOR_ELEMENT_TYPE: HashMap<ElementType, usize> = {
        let mut m = HashMap::<ElementType, usize>::new();

        m.insert(ElementType::Byte, mem::size_of::<i8>());
        m.insert(ElementType::UnsignedByte, mem::size_of::<u8>());
        m.insert(ElementType::Short, mem::size_of::<i16>());
        m.insert(ElementType::UnsignedShort, mem::size_of::<u16>());
        m.insert(ElementType::Int, mem::size_of::<i32>());
        m.insert(ElementType::UnsignedInt, mem::size_of::<u32>());
        m.insert(ElementType::Float, mem::size_of::<f32>());

        m
    };
}

#[non_exhaustive]
#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
pub(crate) enum WebGlExtension {
    OesVertexArrayObject,
    OesTextureFloat,
    OesTextureFloatLinear,
    ExtColorBufferFloat,
}

#[derive(Debug)]
#[repr(u32)]
pub(crate) enum WebGlErrorCode {
    NoError = WebGl2RenderingContext::NO_ERROR as _,
    InvalidEnum = WebGl2RenderingContext::INVALID_ENUM as _,
    InvalidValue = WebGl2RenderingContext::INVALID_VALUE as _,
    InvalidOperation = WebGl2RenderingContext::INVALID_OPERATION as _,
    InvalidFramebufferOperation = WebGl2RenderingContext::INVALID_FRAMEBUFFER_OPERATION as _,
    OutOfMemory = WebGl2RenderingContext::OUT_OF_MEMORY as _,
    ContextLost = WebGl2RenderingContext::CONTEXT_LOST_WEBGL as _,
}

impl TryFrom<GLConstant> for WebGlErrorCode {
    type Error = WebGlError;

    fn try_from(value: GLConstant) -> Result<Self, Self::Error> {
        match value {
            WebGl2RenderingContext::NO_ERROR => Ok(WebGlErrorCode::NoError),
            WebGl2RenderingContext::INVALID_ENUM => Ok(WebGlErrorCode::InvalidEnum),
            WebGl2RenderingContext::INVALID_VALUE => Ok(WebGlErrorCode::InvalidValue),
            WebGl2RenderingContext::INVALID_OPERATION => Ok(WebGlErrorCode::InvalidOperation),
            WebGl2RenderingContext::INVALID_FRAMEBUFFER_OPERATION => {
                Ok(WebGlErrorCode::InvalidFramebufferOperation)
            }
            WebGl2RenderingContext::OUT_OF_MEMORY => Ok(WebGlErrorCode::OutOfMemory),
            WebGl2RenderingContext::CONTEXT_LOST_WEBGL => Ok(WebGlErrorCode::ContextLost),
            _ => Err(WebGlError::UnknownConstant(value, "WebGlErrorCode")),
        }
    }
}
