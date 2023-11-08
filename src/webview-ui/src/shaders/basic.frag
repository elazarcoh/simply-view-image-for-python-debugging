// #version 300 es

precision mediump float;

out vec4 fout_color;

uniform float u_time;
// uniform sampler2D u_texture;


void main() {

    gl_FragColor = vec4(1.0, u_time, 1.0, 1.0);
}