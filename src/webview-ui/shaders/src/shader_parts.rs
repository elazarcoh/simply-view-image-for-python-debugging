#![cfg_attr(rustfmt, rustfmt_skip)]

macro_rules! create_fragment_shader {
    (
        $header:expr,
        $textures:expr,
        $additional_constants:expr,
        $additional_uniforms:expr,
        $additional_functions:expr,
        $sample_code:expr
    ) => {
        const_format::formatcp!(
/*glsl*/ r"#version 300 es
{HEADER}

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

{TEXTURES}

// drawing options
uniform float u_normalization_factor;
uniform mat4 u_color_multiplier;
uniform vec4 u_color_addition;
uniform bool u_invert;
uniform bool u_clip_min;
uniform bool u_clip_max;
uniform float u_min_clip_value;
uniform float u_max_clip_value;

// overlay related uniforms
uniform bool u_is_overlay;
uniform float u_overlay_alpha;
uniform bool u_zeros_as_transparent;
uniform bool u_edges_only;

uniform bool u_use_colormap;
uniform sampler2D u_colormap;

uniform vec2 u_buffer_dimension;
uniform bool u_enable_borders;

const float CHECKER_SIZE = 10.0;
const float WHITE_CHECKER = 0.9;
const float BLACK_CHECKER = 0.6;

// Thickness of the edge as a fraction of the pixel size
const float EDGE_THICKNESS = 0.2;

{ADDITIONAL_CONSTANTS}
{ADDITIONAL_UNIFORMS}

float checkboard(vec2 st) {{
  vec2 pos = mod(st, CHECKER_SIZE * 2.0);
  float value = mod(step(CHECKER_SIZE, pos.x) + step(CHECKER_SIZE, pos.y), 2.0);
  return mix(BLACK_CHECKER, WHITE_CHECKER, value);
}}

bool is_nan(float val) {{
  return (val < 0. || 0. < val || val == 0.) ? false : true;
}}

bool is_edge(vec2 uv) {{
    // Calculate the size of one pixel in texture coordinates
    vec2 texel_size = 1.0 / u_buffer_dimension;

    // Sample the current pixel and its neighbors
    // uint current = texture(u_texture, uv).r;
    float current;
    {{
        vec2 pix = uv;
        vec4 sampled = vec4(0., 0., 0., 1.);
        {SAMPLE_CODE}
        current = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }}
    // uint top = texture(u_texture, uv - vec2(0.0, texel_size.y)).r;
    float top;
    {{
        vec2 pix = uv - vec2(0.0, texel_size.y);
        vec4 sampled = vec4(0., 0., 0., 1.);
        {SAMPLE_CODE}
        top = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }}
    // uint bottom = texture(u_texture, uv + vec2(0.0, texel_size.y)).r;
    float bottom;
    {{
        vec2 pix = uv + vec2(0.0, texel_size.y);
        vec4 sampled = vec4(0., 0., 0., 1.);
        {SAMPLE_CODE}
        bottom = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }}
    // uint left = texture(u_texture, uv - vec2(texel_size.x, 0.0)).r;
    float left;
    {{
        vec2 pix = uv - vec2(texel_size.x, 0.0);
        vec4 sampled = vec4(0., 0., 0., 1.);
        {SAMPLE_CODE}
        left = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }}
    // uint right = texture(u_texture, uv + vec2(texel_size.x, 0.0)).r;
    float right;
    {{
        vec2 pix = uv + vec2(texel_size.x, 0.0);
        vec4 sampled = vec4(0., 0., 0., 1.);
        {SAMPLE_CODE}
        right = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }}

    bool is_left_border = (current != left);
    bool is_right_border = (current != right);
    bool is_top_border = (current != top);
    bool is_bottom_border = (current != bottom);

    // Calculate the position within the pixel
    vec2 pixel_position = fract(uv * u_buffer_dimension);
    // New: compute image-pixel size in screen-pixels and a dynamic threshold.
    float inv_derivative = 1.0 / max(abs(dFdx(uv * u_buffer_dimension).x), abs(dFdy(uv * u_buffer_dimension).y));
    float dynamic_thickness = max(inv_derivative * EDGE_THICKNESS, 1.0);
    
    bool is_top_edge = (pixel_position.y * inv_derivative < dynamic_thickness) && is_top_border;
    bool is_bottom_edge = ((1.0 - pixel_position.y) * inv_derivative < dynamic_thickness) && is_bottom_border;
    bool is_left_edge = (pixel_position.x * inv_derivative < dynamic_thickness) && is_left_border;
    bool is_right_edge = ((1.0 - pixel_position.x) * inv_derivative < dynamic_thickness) && is_right_border;

    return is_top_edge || is_bottom_edge || is_left_edge || is_right_edge;
}}

{ADDITIONAL_FUNCTIONS}


void main() {{
    vec2 pix = vout_uv;

    vec4 sampled = vec4(0., 0., 0., 1.);
    {{
        {SAMPLE_CODE}
    }}

    vec4 color;
    if (
        is_nan(sampled.r) ||
        is_nan(sampled.g) ||
        is_nan(sampled.b) ||
        is_nan(sampled.a)
    ) {{

        color = vec4(0., 0., 0., 1.);

        if (u_invert) {{
            color.rgb = 1. - color.rgb;
        }}

    }} else {{ 
        if (u_clip_min) {{
            sampled = vec4(max(sampled.r, u_min_clip_value),
                        max(sampled.g, u_min_clip_value),
                        max(sampled.b, u_min_clip_value), sampled.a);
        }}
        if (u_clip_max) {{
            sampled = vec4(min(sampled.r, u_max_clip_value),
                        min(sampled.g, u_max_clip_value),
                        min(sampled.b, u_max_clip_value), sampled.a);
        }}

        color = u_color_multiplier * (sampled / u_normalization_factor) +
                u_color_addition;

        color = clamp(color, 0.0, 1.0);

        if (u_invert) {{
            color.rgb = 1. - color.rgb;
        }}

        if (u_use_colormap) {{
            vec2 colormap_uv = vec2(color.r, 0.5);
            vec4 colormap_color = texture(u_colormap, colormap_uv);
            color.rgb = colormap_color.rgb;
        }}
    }}

    if (u_edges_only) {{
        if (!is_edge(vout_uv)) {{
            color = vec4(0.0, 0.0, 0.0, 1.0);
        }} 
    }}

    if (u_zeros_as_transparent && color.r == 0. && color.g == 0. && color.b == 0.) {{
        color.a = 0.0;
    }}

    if (!u_is_overlay) {{
        float c = checkboard(gl_FragCoord.xy);
        color.rgb = mix(vec3(c, c, c), color.rgb, color.a);
    }}

    vec2 buffer_position = vout_uv * u_buffer_dimension;
    if (u_enable_borders) {{
        // in case of overlay, we discard this fragment for pixels that are on the border
        if (u_is_overlay) {{
            bool is_border = (
                buffer_position.x < 1.0 ||
                buffer_position.x > u_buffer_dimension.x - 1.0 ||
                buffer_position.y < 1.0 ||
                buffer_position.y > u_buffer_dimension.y - 1.0
            );
            if (is_border) {{
                discard;
            }}
        }}

        float alpha =
            max(abs(dFdx(buffer_position.x)), abs(dFdx(buffer_position.y)));
        float x_ = fract(buffer_position.x);
        float y_ = fract(buffer_position.y);
        float vertical_border =
            clamp(abs(-1. / alpha * x_ + .5 / alpha) - (.5 / alpha - 1.), 0., 1.);
        float horizontal_border =
            clamp(abs(-1. / alpha * y_ + .5 / alpha) - (.5 / alpha - 1.), 0., 1.);
        color.rgb += vec3(vertical_border + horizontal_border);
    }}

    if (u_is_overlay) {{
        color.a = u_overlay_alpha * color.a;
    }} else {{
        // alpha is always 1.0 after checkboard is mixed in
        color.a = 1.0;
    }}
    
    fout_color = color;
}}

",
            HEADER = $header,
            TEXTURES = $textures,
            ADDITIONAL_CONSTANTS = $additional_constants,
            ADDITIONAL_UNIFORMS = $additional_uniforms,
            ADDITIONAL_FUNCTIONS = $additional_functions,
            SAMPLE_CODE = $sample_code
        )
    };
}

pub(crate) use create_fragment_shader;


/**
 * Headers
 */
pub(crate) const NORMALIZED_HEADER: &str = /*glsl*/ r"
precision highp float;
precision highp sampler2D;
";

pub(crate) const UINT_HEADER: &str = /*glsl*/ r"
precision highp float;
precision highp int;
precision highp usampler2D;
";

pub(crate) const INT_HEADER: &str = /*glsl*/ r"
precision highp float;
precision highp int;
precision highp isampler2D;
";

/**
 * Textures
 */
pub(crate) const NORMALIZED_TEXTURES: &str = /*glsl*/ r"
uniform sampler2D u_texture;
";
pub(crate) const UINT_TEXTURES: &str = /*glsl*/ r"
uniform usampler2D u_texture;
";
pub(crate) const INT_TEXTURES: &str = /*glsl*/ r"
uniform isampler2D u_texture;
";
pub(crate) const NORMALIZED_PLANAR_TEXTURES: &str = /*glsl*/ r"
uniform int u_image_type;

uniform sampler2D u_texture_r;
uniform sampler2D u_texture_g;
uniform sampler2D u_texture_b;
uniform sampler2D u_texture_a;
";
pub(crate) const UINT_PLANAR_TEXTURES: &str = /*glsl*/ r"
uniform int u_image_type;

uniform usampler2D u_texture_r;
uniform usampler2D u_texture_g;
uniform usampler2D u_texture_b;
uniform usampler2D u_texture_a;
";

pub(crate) const INT_PLANAR_TEXTURES: &str = /*glsl*/ r"
uniform int u_image_type;

uniform isampler2D u_texture_r;
uniform isampler2D u_texture_g;
uniform isampler2D u_texture_b;
uniform isampler2D u_texture_a;
";

/**
 * Constants
 */
pub(crate) const PLANAR_CONSTANTS: &str = /*glsl*/ r"
const int NEED_RED = 1;
const int NEED_GREEN = 2;
const int NEED_BLUE = 4;
const int NEED_ALPHA = 8;

const int IMAGE_TYPE_GRAYSCALE = 0;
const int IMAGE_TYPE_RGB = 1;
const int IMAGE_TYPE_RGBA = 2;
const int IMAGE_TYPE_GA = 3;

const int TYPE_TO_NEED[4] = int[](
    NEED_RED,
    NEED_RED | NEED_GREEN | NEED_BLUE,
    NEED_RED | NEED_GREEN | NEED_BLUE | NEED_ALPHA,
    NEED_RED | NEED_GREEN
);
";


/** 
 * Sampler
 */
// Works for both int and uint
pub(crate) const INTEGER_PLANAR_SAMPLE: &str = /*glsl*/ r"

int need = TYPE_TO_NEED[u_image_type];
if ((need & NEED_RED) != 0) {
    sampled.r = float(texture(u_texture_r, pix).r);
}
if ((need & NEED_GREEN) != 0) {
    sampled.g = float(texture(u_texture_g, pix).r);
}
if ((need & NEED_BLUE) != 0) {
    sampled.b = float(texture(u_texture_b, pix).r);
}
if ((need & NEED_ALPHA) != 0) {
    sampled.a = float(texture(u_texture_a, pix).r);
}

";

pub(crate) const NORMALIZED_PLANAR_SAMPLE: &str = /*glsl*/ r"

    int need = TYPE_TO_NEED[u_image_type];
    if ((need & NEED_RED) != 0) {
        sampled.r = texture(u_texture_r, pix).r;
    }
    if ((need & NEED_GREEN) != 0) {
        sampled.g = texture(u_texture_g, pix).r;
    }
    if ((need & NEED_BLUE) != 0) {
        sampled.b = texture(u_texture_b, pix).r;
    }
    if ((need & NEED_ALPHA) != 0) {
        sampled.a = texture(u_texture_a, pix).r;
    }

    ";

pub(crate) const UINT_SAMPLE: &str = /*glsl*/ r"
uvec4 texel = texture(u_texture, pix);
sampled =
    vec4(float(texel.r), float(texel.g), float(texel.b), float(texel.a));
";

pub(crate) const INT_SAMPLE: &str = /*glsl*/ r"
ivec4 texel = texture(u_texture, pix);
sampled =
    vec4(float(texel.r), float(texel.g), float(texel.b), float(texel.a));
";

pub(crate) const NORMALIZED_SAMPLE: &str = /*glsl*/ r"
sampled = texture(u_texture, pix);
";

