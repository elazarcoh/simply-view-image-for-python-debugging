#version 300 es
precision mediump float;

in vec2 vout_uv;
layout(location = 0) out vec4 fout_color;

uniform vec2 u_time;
uniform vec2 u_offset;

uniform sampler2D u_texture;
uniform mat4 u_color_multiplier;

uniform vec2 u_buffer_dimension;
uniform bool u_enable_borders;

void main()
{
  vec4 sampled = texture(u_texture,vout_uv);
  vec4 color= vec4((u_color_multiplier*vec4(sampled.rgb,1.0)).rgb,sampled.a);
  
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