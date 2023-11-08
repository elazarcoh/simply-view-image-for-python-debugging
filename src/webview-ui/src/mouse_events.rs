use wasm_bindgen::JsCast;
use web_sys::MouseEvent;

fn get_clip_space_mouse_position(e: MouseEvent) -> () {
    // get canvas relative css position
    // const rect = this.canvas.getBoundingClientRect();
    // const cssX = e.clientX - rect.left;
    // const cssY = e.clientY - rect.top;

    // // get normalized 0 to 1 position across and down canvas
    // const normalizedX = cssX / this.canvas.clientWidth;
    // const normalizedY = cssY / this.canvas.clientHeight;

    // // convert to clip space
    // const clipX = normalizedX * 2 - 1;
    // const clipY = normalizedY * -2 + 1;

    // return [clipX, clipY];
}

pub fn on_wheel(event: &MouseEvent) {
    let data = event
        .dyn_ref::<web_sys::WheelEvent>()
        .expect("Unable to cast event to WheelEvent")
        .delta_y();
    log::debug!("WheelEvent: {:?}", data);
    event.prevent_default();
}
