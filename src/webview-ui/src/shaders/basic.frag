precision mediump float;

uniform float u_time;

void main() {

    gl_FragColor = vec4(1.0, u_time, 1.0, 1.0);
}