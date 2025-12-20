#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

uniform usampler2D u_texture;
uniform vec2 u_texture_size;

// drawing options
uniform float u_normalization_factor;
uniform mat4 u_color_multiplier;
uniform vec4 u_color_addition;
uniform bool u_invert;
uniform bool u_clip_min;
uniform bool u_clip_max;
uniform float u_min_clip_value;
uniform float u_max_clip_value;
uniform bool u_only_edges;

uniform bool u_use_colormap;
uniform sampler2D u_colormap;

uniform vec2 u_buffer_dimension;
uniform bool u_enable_borders;

// Thickness of the edge as a fraction of the pixel size
const float EDGE_THICKNESS = 0.2;

const float CHECKER_SIZE = 10.0;
const float WHITE_CHECKER = 0.9;
const float BLACK_CHECKER = 0.6;

float checkboard(vec2 st) {
  vec2 pos = mod(st, CHECKER_SIZE * 2.0);
  float value = mod(step(CHECKER_SIZE, pos.x) + step(CHECKER_SIZE, pos.y), 2.0);
  return mix(BLACK_CHECKER, WHITE_CHECKER, value);
}

void main() {
  vec2 pix = vout_uv;

  uvec4 texel = texture(u_texture, pix);

  vec4 sampled =
      vec4(float(texel.r), float(texel.g), float(texel.b), float(texel.a));

  if (u_only_edges) {
    // Calculate the size of one pixel in texture coordinates
    vec2 texel_size = 1.0 / u_texture_size;

    // Sample the current pixel and its neighbors
    uint current = texture(u_texture, vout_uv).r;
    uint top = texture(u_texture, vout_uv - vec2(0.0, texel_size.y)).r;
    uint bottom = texture(u_texture, vout_uv + vec2(0.0, texel_size.y)).r;
    uint left = texture(u_texture, vout_uv - vec2(texel_size.x, 0.0)).r;
    uint right = texture(u_texture, vout_uv + vec2(texel_size.x, 0.0)).r;

    bool is_left_border = (current != left);
    bool is_right_border = (current != right);
    bool is_top_border = (current != top);
    bool is_bottom_border = (current != bottom);

    // Calculate the position within the pixel
    vec2 pixel_position = fract(vout_uv * u_texture_size);

    bool is_top_edge = pixel_position.y < EDGE_THICKNESS && is_top_border;
    bool is_bottom_edge =
        pixel_position.y > (1.0 - EDGE_THICKNESS) && is_bottom_border;
    bool is_left_edge = pixel_position.x < EDGE_THICKNESS && is_left_border;
    bool is_right_edge =
        pixel_position.x > (1.0 - EDGE_THICKNESS) && is_right_border;

    if (is_top_edge || is_bottom_edge || is_left_edge || is_right_edge) {

    } else {
      sampled = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }

  if (u_clip_min) {
    sampled =
        vec4(max(sampled.r, u_min_clip_value), max(sampled.g, u_min_clip_value),
             max(sampled.b, u_min_clip_value), sampled.a);
  }
  if (u_clip_max) {
    sampled =
        vec4(min(sampled.r, u_max_clip_value), min(sampled.g, u_max_clip_value),
             min(sampled.b, u_max_clip_value), sampled.a);
  }

  sampled /= u_normalization_factor;

  vec4 color = u_color_multiplier * sampled + u_color_addition;

  color = clamp(color, 0.0, 1.0);

  if (u_invert) {
    color.rgb = 1. - color.rgb;
  }

  if (u_use_colormap) {
    vec2 colormap_uv = vec2(color.r, 0.5);
    vec4 colormap_color = texture(u_colormap, colormap_uv);
    color.rgb = colormap_color.rgb;
  }

  float c = checkboard(gl_FragCoord.xy);
  color.rgb = mix(vec3(c, c, c), color.rgb, color.a);

  vec2 buffer_position = vout_uv * u_buffer_dimension;
  if (u_enable_borders) {
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

  fout_color = color;
}