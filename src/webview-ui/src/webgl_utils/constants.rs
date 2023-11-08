use std::convert::TryFrom;
use std::mem;

use std::collections::HashMap;

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
pub enum Format {
    Alpha = GL::ALPHA,
    Rgb = GL::RGB,
    Rgba = GL::RGBA,
    Luminance = GL::LUMINANCE,
    LuminanceAlpha = GL::LUMINANCE_ALPHA,
    Red = GL::RED,
    Rg = GL::RG,
    RedInteger = GL::RED_INTEGER,
    RgInteger = GL::RG_INTEGER,
    RgbInteger = GL::RGB_INTEGER,
    RgbaInteger = GL::RGBA_INTEGER,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum InternalFormat {
    Rgb = GL::RGB,
    Rgba = GL::RGBA,
    LuminanceAlpha = GL::LUMINANCE_ALPHA,
    Luminance = GL::LUMINANCE,
    Alpha = GL::ALPHA,
    R8 = GL::R8,
    R16F = GL::R16F,
    R32F = GL::R32F,
    R8Ui = GL::R8UI,
    Rg8 = GL::RG8,
    Rg16F = GL::RG16F,
    Rg32F = GL::RG32F,
    Rg8Ui = GL::RG8UI,
    Rgb8 = GL::RGB8,
    Srgb8 = GL::SRGB8,
    Rgb565 = GL::RGB565,
    R11FG11FB10F = GL::R11F_G11F_B10F,
    Rgb9E5 = GL::RGB9_E5,
    Rgb16F = GL::RGB16F,
    Rgb32F = GL::RGB32F,
    Rgb8Ui = GL::RGB8UI,
    Rgba8 = GL::RGBA8,
    Srgb8Alpha8 = GL::SRGB8_ALPHA8,
    Rgb5A1 = GL::RGB5_A1,
    Rgb10A2 = GL::RGB10_A2,
    Rgba4 = GL::RGBA4,
    Rgba16F = GL::RGBA16F,
    Rgba32F = GL::RGBA32F,
    Rgba8Ui = GL::RGBA8UI,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum TextureTarget {
    Texture2D = GL::TEXTURE_2D,
    TextureCubeMap = GL::TEXTURE_CUBE_MAP,
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

#[allow(clippy::enum_variant_names)]
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

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug)]
#[repr(u32)]
pub enum DrawMode {
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
pub enum Capability {
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
    pub static ref GL_ATTRIBUTE_SETTER_FOR_TYPE: HashMap<GLPrimitive, AttributeSetterBuilder> = {
        let mut m = HashMap::<GLPrimitive, AttributeSetterBuilder>::new();

        m.insert(GLPrimitive::Float, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec2, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec3, float_attribute_setter);
        m.insert(GLPrimitive::FloatVec4, float_attribute_setter);

        m
    };
}

lazy_static! {
    pub static ref BYTES_FOR_ELEMENT_TYPE: HashMap<ElementType, usize> = {
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
pub enum WebGlExtension {
    OesVertexArrayObject,
    OesTextureFloat,
    OesTextureFloatLinear,
    ExtColorBufferFloat,
}
