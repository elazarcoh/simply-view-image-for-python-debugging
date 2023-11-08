#version 300 es
precision mediump float;

in vec2 vout_uv;

out vec4 fout_color;

uniform sampler2D u_texture;
uniform vec4 u_pixelColor;
uniform sampler2D u_gylphTexture;

vec3 textColor(vec3 c) {
  float gray = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  return vec3(1.0 - floor(gray + 0.5));
}

void main()
{
  vec4 gylph=texture(u_gylphTexture,vout_uv);
  if (gylph.r == 0.0) discard;
  fout_color=vec4(textColor(u_pixelColor.rgb), gylph.r);
}