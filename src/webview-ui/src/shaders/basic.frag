#version 300 es
precision mediump float;

layout(location = 0) out vec4 fout_color;

uniform float u_time;
uniform sampler2D u_texture;


void main() {

    vec2 uv = vec2(0.5, u_time);
    vec4 color=texture(u_texture, uv);

    // fout_color = vec4(1.0, u_time, 1.0, 1.0);
    fout_color = color;
}