#version 300 es
in vec2 vin_position;

in vec2 uv;
out vec2 vout_uv;

uniform mat3 u_projectionMatrix;
uniform mat3 u_imageToScreenMatrix;

void main() {
  vec3 p = (u_projectionMatrix * u_imageToScreenMatrix * vec3(vin_position, 1));
  gl_Position = vec4(p.xy, 0, 1);
  vout_uv = uv;
}