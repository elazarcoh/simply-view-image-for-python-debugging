use wasm_bindgen::JsCast;
use web_sys::{HtmlCanvasElement, WebGl2RenderingContext};
use web_sys::{HtmlElement, WebGl2RenderingContext as GL};

pub(crate) fn gl_canvas(gl: &GL) -> HtmlCanvasElement {
    gl.canvas()
        .unwrap()
        .dyn_into::<HtmlCanvasElement>()
        .unwrap()
}

pub(crate) fn scissor_view(gl: &WebGl2RenderingContext, element: &HtmlElement) {
    let canvas = gl_canvas(gl);

    let rect = element.get_bounding_client_rect();
    let width = rect.right() - rect.left();
    let height = rect.bottom() - rect.top();
    let left = rect.left();
    let bottom = canvas.client_height() as f64 - rect.bottom();

    gl.viewport(left as i32, bottom as i32, width as i32, height as i32);
    gl.scissor(left as i32, bottom as i32, width as i32, height as i32);
}
