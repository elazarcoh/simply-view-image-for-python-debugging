#version 300 es
precision mediump float;

in vec2 vin_position;
in vec2 uv;

out vec2 vout_uv;

void main() {
  gl_Position = vec4(vin_position.xy, 0, 1);

  vout_uv = uv;
}

