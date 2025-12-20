mod shader_parts;
use shader_parts::*;

pub const NORMALIZED_FRAGMENT_SHADER: &str = create_fragment_shader!(
    NORMALIZED_HEADER,
    NORMALIZED_TEXTURES,
    "",
    PLANAR_CONSTANTS,
    "",
    NORMALIZED_SAMPLE
);
pub const UINT_FRAGMENT_SHADER: &str = create_fragment_shader!(
    UINT_HEADER,
    UINT_TEXTURES,
    "",
    PLANAR_CONSTANTS,
    "",
    UINT_SAMPLE
);

pub const INT_FRAGMENT_SHADER: &str = create_fragment_shader!(
    INT_HEADER,
    INT_TEXTURES,
    "",
    PLANAR_CONSTANTS,
    "",
    INT_SAMPLE
);

pub const NORMALIZED_PLANAR_FRAGMENT_SHADER: &str = create_fragment_shader!(
    NORMALIZED_HEADER,
    NORMALIZED_PLANAR_TEXTURES,
    "",
    PLANAR_CONSTANTS,
    "",
    NORMALIZED_PLANAR_SAMPLE
);
pub const UINT_PLANAR_FRAGMENT_SHADER: &str = create_fragment_shader!(
    UINT_HEADER,
    UINT_PLANAR_TEXTURES,
    "",
    PLANAR_CONSTANTS,
    "",
    INTEGER_PLANAR_SAMPLE
);
pub const INT_PLANAR_FRAGMENT_SHADER: &str = create_fragment_shader!(
    INT_HEADER,
    INT_PLANAR_TEXTURES,
    "",
    PLANAR_CONSTANTS,
    "",
    INTEGER_PLANAR_SAMPLE
);
