use wasm_bindgen::JsCast;
use web_sys::MouseEvent;

fn get_clip_space_mouse_position(e: MouseEvent, canvas: &web_sys::HtmlCanvasElement) -> [f64; 2] {
    // get canvas relative css position
    let rect = canvas.get_bounding_client_rect();
    let css_x = e.client_x() as f64 - rect.left();
    let css_y = e.client_y() as f64 - rect.top();

    // get normalized 0 to 1 position across and down canvas
    let normalized_x = css_x / canvas.client_width() as f64;
    let normalized_y = css_y / canvas.client_height() as f64;

    // convert to clip space
    let clip_x = normalized_x * 2_f64 - 1_f64;
    let clip_y = normalized_y * -2_f64 + 1_f64;

    return [clip_x, clip_y];
}

pub fn on_wheel(event: &web_sys::WheelEvent, canvas: &web_sys::HtmlCanvasElement) -> () {
    event.prevent_default();
    let [clip_x, clip_y] = get_clip_space_mouse_position(event.clone().dyn_into().unwrap(), canvas);
}
