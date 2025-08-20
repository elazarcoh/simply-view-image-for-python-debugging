#version 300 es

precision highp float;
precision highp sampler2D;


in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;


uniform int u_image_type;

uniform sampler2D u_texture_r;
uniform sampler2D u_texture_g;
uniform sampler2D u_texture_b;
uniform sampler2D u_texture_a;


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


float checkboard(vec2 st) {
  vec2 pos = mod(st, CHECKER_SIZE * 2.0);
  float value = mod(step(CHECKER_SIZE, pos.x) + step(CHECKER_SIZE, pos.y), 2.0);
  return mix(BLACK_CHECKER, WHITE_CHECKER, value);
}

bool is_nan(float val) {
  return (val < 0. || 0. < val || val == 0.) ? false : true;
}

bool is_edge(vec2 uv) {
    // Calculate the size of one pixel in texture coordinates
    vec2 texel_size = 1.0 / u_buffer_dimension;

    // Sample the current pixel and its neighbors
    float current;
    {
        vec2 pix = uv;
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        current = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float top;
    {
        vec2 pix = uv - vec2(0.0, texel_size.y);
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        top = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float bottom;
    {
        vec2 pix = uv + vec2(0.0, texel_size.y);
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        bottom = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float left;
    {
        vec2 pix = uv - vec2(texel_size.x, 0.0);
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        left = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float right;
    {
        vec2 pix = uv + vec2(texel_size.x, 0.0);
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        right = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float top_left;
    {
        vec2 pix = uv - texel_size;
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        top_left = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float top_right;
    {
        vec2 pix = uv + vec2(texel_size.x, -texel_size.y);
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        top_right = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float bottom_left;
    {
        vec2 pix = uv + vec2(-texel_size.x, texel_size.y);
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        bottom_left = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }
    float bottom_right;
    {
        vec2 pix = uv + texel_size;
        vec4 sampled = vec4(0., 0., 0., 1.);
        

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

    
        bottom_right = sampled.r; // Assuming sampled is defined in the SAMPLE_CODE
    }

    bool is_left_border = (current != left);
    bool is_right_border = (current != right);
    bool is_top_border = (current != top);
    bool is_bottom_border = (current != bottom);
    bool is_top_left_border = (current != top_left);
    bool is_top_right_border = (current != top_right);
    bool is_bottom_left_border = (current != bottom_left);
    bool is_bottom_right_border = (current != bottom_right);

    // Calculate the position within the pixel
    vec2 pixel_position = fract(uv * u_buffer_dimension);
    // New: compute image-pixel size in screen-pixels and a dynamic threshold.
    float inv_derivative = 1.0 / max(abs(dFdx(uv * u_buffer_dimension).x), abs(dFdy(uv * u_buffer_dimension).y));
    float dynamic_thickness = max(inv_derivative * EDGE_THICKNESS, 1.0);
    
    bool is_top_edge = (pixel_position.y * inv_derivative < dynamic_thickness) && is_top_border;
    bool is_bottom_edge = ((1.0 - pixel_position.y) * inv_derivative < dynamic_thickness) && is_bottom_border;
    bool is_left_edge = (pixel_position.x * inv_derivative < dynamic_thickness) && is_left_border;
    bool is_right_edge = ((1.0 - pixel_position.x) * inv_derivative < dynamic_thickness) && is_right_border;
    bool is_top_left_edge = ((pixel_position.x * inv_derivative < dynamic_thickness) &&
                           (pixel_position.y * inv_derivative < dynamic_thickness)) &&
                           is_top_left_border;
    bool is_top_right_edge = (((1.0 - pixel_position.x) * inv_derivative < dynamic_thickness) &&
                            (pixel_position.y * inv_derivative < dynamic_thickness)) &&
                            is_top_right_border;
    bool is_bottom_left_edge = ((pixel_position.x * inv_derivative < dynamic_thickness) &&
                              ((1.0 - pixel_position.y) * inv_derivative < dynamic_thickness)) &&
                              is_bottom_left_border;
    bool is_bottom_right_edge = (((1.0 - pixel_position.x) * inv_derivative < dynamic_thickness) &&
                               ((1.0 - pixel_position.y) * inv_derivative < dynamic_thickness)) &&
                               is_bottom_right_border;

    // Return true if any edge condition is met
    return is_top_edge || is_bottom_edge || is_left_edge || is_right_edge ||
           is_top_left_edge || is_top_right_edge || is_bottom_left_edge ||
           is_bottom_right_edge;
}




void main() {
    vec2 pix = vout_uv;

    vec4 sampled = vec4(0., 0., 0., 1.);
    {
        

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

    
    }

    vec4 color;
    if (
        is_nan(sampled.r) ||
        is_nan(sampled.g) ||
        is_nan(sampled.b) ||
        is_nan(sampled.a)
    ) {

        color = vec4(0., 0., 0., 1.);

        if (u_invert) {
            color.rgb = 1. - color.rgb;
        }

    } else { 
        if (u_clip_min) {
            sampled = vec4(max(sampled.r, u_min_clip_value),
                        max(sampled.g, u_min_clip_value),
                        max(sampled.b, u_min_clip_value), sampled.a);
        }
        if (u_clip_max) {
            sampled = vec4(min(sampled.r, u_max_clip_value),
                        min(sampled.g, u_max_clip_value),
                        min(sampled.b, u_max_clip_value), sampled.a);
        }

        color = u_color_multiplier * (sampled / u_normalization_factor) +
                u_color_addition;

        color = clamp(color, 0.0, 1.0);

        if (u_invert) {
            color.rgb = 1. - color.rgb;
        }

        if (u_use_colormap) {
            vec2 colormap_uv = vec2(color.r, 0.5);
            vec4 colormap_color = texture(u_colormap, colormap_uv);
            color.rgb = colormap_color.rgb;
        }
    }

    if (u_edges_only) {
        if (!is_edge(vout_uv)) {
            color = vec4(0.0, 0.0, 0.0, 1.0);
        } 
    }

    if (u_zeros_as_transparent && color.r == 0. && color.g == 0. && color.b == 0.) {
        color.a = 0.0;
    }

    if (!u_is_overlay) {
        float c = checkboard(gl_FragCoord.xy);
        color.rgb = mix(vec3(c, c, c), color.rgb, color.a);
    }

    vec2 buffer_position = vout_uv * u_buffer_dimension;
    if (u_enable_borders && !u_is_overlay) {
        float alpha =
            max(abs(dFdx(buffer_position.x)), abs(dFdx(buffer_position.y)));
        float x_ = fract(buffer_position.x);
        float y_ = fract(buffer_position.y);
        float vertical_border =
            clamp(abs(-1. / alpha * x_ + .5 / alpha) - (.5 / alpha - 1.), 0., 1.);
        float horizontal_border =
            clamp(abs(-1. / alpha * y_ + .5 / alpha) - (.5 / alpha - 1.), 0., 1.);
        color.rgb += vec3(vertical_border + horizontal_border);
    }

    if (u_is_overlay) {
        color.a = u_overlay_alpha * color.a;
    } else {
        // alpha is always 1.0 after checkboard is mixed in
        color.a = 1.0;
    }
    
    fout_color = color;
}

