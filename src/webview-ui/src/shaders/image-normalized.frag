#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

uniform sampler2D u_texture;

// drawing options
uniform float u_normalization_factor;
uniform mat4 u_color_multiplier;
uniform vec4 u_color_addition;
uniform bool u_invert;
uniform bool u_clip_min;
uniform bool u_clip_max;
uniform float u_min_clip_value;
uniform float u_max_clip_value;

uniform bool u_use_colormap;
uniform sampler2D u_colormap;

uniform vec2 u_buffer_dimension;
uniform bool u_enable_borders;

const float CHECKER_SIZE = 10.0;
const float WHITE_CHECKER = 0.9;
const float BLACK_CHECKER = 0.6;

float checkboard(vec2 st) {
  vec2 pos = mod(st, CHECKER_SIZE * 2.0);
  float value = mod(step(CHECKER_SIZE, pos.x) + step(CHECKER_SIZE, pos.y), 2.0);
  return mix(BLACK_CHECKER, WHITE_CHECKER, value);
}

bool is_nan(float val) {
  return (val < 0. || 0. < val || val == 0.) ? false : true;
}

void main() {
  vec2 pix = vout_uv;
  vec4 sampled = texture(u_texture, pix);

  vec4 color;
  if (is_nan(sampled.r) || is_nan(sampled.g) || is_nan(sampled.b) ||
      is_nan(sampled.a)) {
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

  float c = checkboard(gl_FragCoord.xy);
  color.rgb = mix(vec3(c, c, c), color.rgb, sampled.a);

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