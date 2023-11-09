#version 300 es
precision mediump float;

in vec2 vout_uv;

layout(location = 0) out vec4 fout_color;

uniform vec4 u_textColor;
uniform sampler2D u_gylphTexture;

void main()
{
  vec4 gylph=texture(u_gylphTexture, vout_uv);
  if (gylph.r == 0.0) discard;
  fout_color=vec4(u_textColor.rgb, gylph.r);
}