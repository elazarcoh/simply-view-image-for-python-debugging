precision mediump float;

attribute vec2 a_position;
uniform float u_time;

void main() {
    gl_Position = vec4(a_position, u_time, 1.0);
}