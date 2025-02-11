#version 300 es
precision mediump float;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

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

  float clip_min = 0.0;
  float clip_max = 1.0;

  if (u_clip_min) {
    clip_min = u_min_clip_value;
  }
  if (u_clip_max) {
    clip_max = u_max_clip_value;
  }

  float width = clip_max - clip_min;
  value = clamp(value, clip_min, clip_max);
  value = (value - clip_min) / width;

  vec2 colormap_uv = vec2(value, 0.5);
  vec4 colormap_color = texture(u_colormap, colormap_uv);
  vec4 color = vec4(colormap_color.rgb, 1.0);

  fout_color = color;
}