use glam::Vec3Swizzles;
use wasm_bindgen::JsCast;
use web_sys::MouseEvent;

use crate::{
    common::Size,
    image_view::camera::{self, Camera},
};

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

pub fn calculate_camera_after_wheel_zoom(
    event: &web_sys::WheelEvent,
    canvas: &web_sys::HtmlCanvasElement,
    camera: &Camera,
) -> Camera {
    event.prevent_default();
    let [clip_x, clip_y] = get_clip_space_mouse_position(event.clone().dyn_into().unwrap(), canvas);

    let canvas_size = Size {
        width: canvas.width() as f32,
        height: canvas.height() as f32,
    };
    let view_size = Size {
        width: 1.0,
        height: 1.0,
    };
    let view_projection_matrix_inv =
        camera::calculate_view_projection(&canvas_size, &view_size, camera).inverse();
    let pre_zoom_position =
        (view_projection_matrix_inv * glam::Vec3::new(clip_x as f32, clip_y as f32, 1.0)).xy();

    let delta_y = event.delta_y();
    log::debug!("zoom before: {}", camera.zoom);
    log::debug!("delta_y: {}", delta_y);
    let new_zoom = camera.zoom * (f32::powf(2.0, delta_y as f32 / 100.0));
    let new_zoom = f32::clamp(new_zoom, 0.8, 10.0); // TODO: make these configurable
    log::debug!("zoom after: {}", new_zoom);

    let new_camera = Camera {
        zoom: new_zoom,
        ..*camera
    };

    let view_projection_matrix_inv =
        camera::calculate_view_projection(&canvas_size, &view_size, &new_camera).inverse();
    let post_zoom_position =
        (view_projection_matrix_inv * glam::Vec3::new(clip_x as f32, clip_y as f32, 1.0)).xy();

    let translation = camera.translation + (pre_zoom_position - post_zoom_position);

    let new_camera = Camera {
        translation,
        ..new_camera
    };

    new_camera
}
