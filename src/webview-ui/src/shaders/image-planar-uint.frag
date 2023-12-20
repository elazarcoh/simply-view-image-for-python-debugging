#version 300 es
precision mediump float;
precision mediump usampler2D;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

// Enum for image type
const int NEED_RED = 1;
const int NEED_GREEN = 2;
const int NEED_BLUE = 4;
const int NEED_ALPHA = 8;

const int IMAGE_TYPE_GRAYSCALE = 0;
const int IMAGE_TYPE_RGB = 1;
const int IMAGE_TYPE_RGBA = 2;
const int IMAGE_TYPE_GA = 3;

// clang-format off
const int TYPE_TO_NEED[4] = int[](
    NEED_RED,
    NEED_RED | NEED_GREEN | NEED_BLUE,
    NEED_RED | NEED_GREEN | NEED_BLUE | NEED_ALPHA,
    NEED_RED | NEED_GREEN
);
// clang-format on

// image type
uniform int u_image_type;

uniform usampler2D u_texture_r;
uniform usampler2D u_texture_g;
uniform usampler2D u_texture_b;
uniform usampler2D u_texture_a;

// drawing options
uniform mat4 u_color_multiplier;
uniform vec4 u_color_addition;
uniform bool u_invert;

uniform bool u_use_colormap;
uniform sampler2D u_colormap;

uniform vec2 u_buffer_dimension;
uniform bool u_enable_borders;

const float CHECKER_SIZE = 10.0;
const float WHITE_CHECKER = 0.9;
const float BLACK_CHECKER = 0.6;

// @include "./common-functions.glsl"
float checkboard(vec2 st) {
  vec2 pos = mod(st, CHECKER_SIZE * 2.0);
  float value = mod(step(CHECKER_SIZE, pos.x) + step(CHECKER_SIZE, pos.y), 2.0);
  return mix(BLACK_CHECKER, WHITE_CHECKER, value);
}

void main() {
  vec2 pix = vout_uv;

  vec4 sampled = vec4(0., 0., 0., 1.);

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

  vec4 color = u_color_multiplier * sampled + u_color_addition;

  color = clamp(color, 0.0, 1.0);

  if (u_invert) {
    color.rgb = 1. - color.rgb;
  }

  if (u_use_colormap) {
    vec2 colormap_uv = vec2(color.r, 0.5);
    vec4 colormap_color = texture(u_colormap, colormap_uv);
    // vec4 colormap_color = vec4(1., 0., 0., 1.);
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