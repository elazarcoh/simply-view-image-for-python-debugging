#version 300 es
precision mediump float;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

uniform bool u_use_colormap;
uniform sampler2D u_colormap;

uniform bool u_clip_min;
uniform bool u_clip_max;
uniform float u_min_clip_value;
uniform float u_max_clip_value;

// Directions: 0 = horizontal, 1 = vertical
uniform int u_direction;

void main() {
  float value = vout_uv.x;
  if (u_direction == 1) {
    value = vout_uv.y;
  }

  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  if (u_clip_min) {
    value = max(value, u_min_clip_value);
  }
  if (u_clip_max) {
    value = min(value, u_max_clip_value);
  }

  if (u_use_colormap) {
    vec2 colormap_uv = vec2(value, 0.5);
    vec4 colormap_color = texture(u_colormap, colormap_uv);
    color.rgb = colormap_color.rgb;
  }

  fout_color = color;
}