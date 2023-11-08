#version 300 es
precision mediump float;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

uniform vec2 u_offset;

uniform sampler2D u_texture;

// drawing options
uniform mat4 u_color_multiplier;
uniform bool u_invert;

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

void main()
{
  vec2 pix = vout_uv;
  vec4 sampled = texture(u_texture, pix);
  vec4 color = vec4((u_color_multiplier*vec4(sampled.rgb,1.0)).rgb,sampled.a);

  if(u_invert){
    color.rgb = 1.-color.rgb;
  }

  float c = checkboard(gl_FragCoord.xy);
  color.rgb = mix(vec3(c, c, c), color.rgb, sampled.a);
  
  vec2 buffer_position=vout_uv*u_buffer_dimension;
  if(u_enable_borders){
    float alpha=max(abs(dFdx(buffer_position.x)),abs(dFdx(buffer_position.y)));
    float x_=fract(buffer_position.x);
    float y_=fract(buffer_position.y);
    float vertical_border=clamp(abs(-1./alpha*x_+.5/alpha)-(.5/alpha-1.),0.,1.);
    float horizontal_border=clamp(abs(-1./alpha*y_+.5/alpha)-(.5/alpha-1.),0.,1.);
    color.rgb+=vec3(vertical_border+horizontal_border);
  }
  
  fout_color=color;
  
}