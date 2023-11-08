#version 300 es
precision mediump float;

in vec2 vin_position;
in vec2 uv;

uniform mat3 u_projectionMatrix;
uniform mat3 u_imageToScreenMatrix;

out vec2 vout_uv;

void main()
{
  
  // vec3 p=(u_projectionMatrix*u_imageToScreenMatrix*vec3(vin_position,1));
  vec3 p=(u_projectionMatrix*vec3(vin_position,1));
  gl_Position=vec4(p.xy,0,1);
  // gl_Position=vec4(vin_position.xy,0,1);
  vout_uv=uv;
}