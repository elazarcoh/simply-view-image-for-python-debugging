use std::{cell::RefCell, rc::Rc};

use glam::{Mat3, UVec2, Vec2, Vec3Swizzles};
use gloo::events::{EventListener, EventListenerOptions};
use wasm_bindgen::JsCast;
use web_sys::{Event, MouseEvent};
use yew::Callback;
use yewdux::Dispatch;

use crate::{
    app_state::app_state::{AppState, ChangeImageAction},
    common::{camera, constants::MAX_PIXEL_SIZE_DEVICE, Size, ViewId},
    math_utils::{image_calculations::calculate_pixels_information, ToHom},
    rendering::{constants::VIEW_SIZE, rendering_context::ViewContext},
};

fn get_clip_space_mouse_position(e: MouseEvent, element: &web_sys::HtmlElement) -> Vec2 {
    let rect = element.get_bounding_client_rect();
    let css_x = e.client_x() as f32 - rect.left() as f32;
    let css_y = e.client_y() as f32 - rect.top() as f32;

    let normalized_x = css_x / element.client_width() as f32;
    let normalized_y = css_y / element.client_height() as f32;

    let clip_x = normalized_x * 2.0 - 1.0;
    let clip_y = normalized_y * -2.0 + 1.0;

    [clip_x, clip_y].into()
}

pub(crate) struct PanHandler {
    is_panning: bool,
    start_camera: camera::Camera,
    start_in_view_projection_matrix: Mat3,
    start_mouse_position: Vec2,
}

impl PanHandler {
    fn new() -> Self {
        Self {
            is_panning: false,
            start_camera: camera::Camera::default(),
            start_in_view_projection_matrix: Mat3::IDENTITY,
            start_mouse_position: [0.0, 0.0].into(),
        }
    }

    pub(crate) fn install(
        view_id: ViewId,
        view_context: Rc<dyn ViewContext>,
    ) -> Vec<EventListener> {
        let handler = Rc::new(RefCell::new(Self::new()));
        let view_element = view_context.get_view_element(view_id);

        let mousedown = {
            let view_context = Rc::clone(&view_context);
            let self_handler = Rc::clone(&handler);
            let view_element = view_element.clone();
            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::MouseEvent>()
                    .expect("Unable to cast event to MouseEvent");
                let camera = view_context.get_camera_for_view(view_id);
                let element_size = Size {
                    width: view_element.client_width() as f32,
                    height: view_element.client_height() as f32,
                };
                let image_size = match view_context.get_image_size_for_view(view_id) {
                    Some(it) => it,
                    None => return,
                };
                let aspect_ratio = image_size.width as f32 / image_size.height as f32;

                let start_in_view_projection_matrix = camera::calculate_view_projection(
                    &element_size,
                    &VIEW_SIZE,
                    &camera,
                    aspect_ratio,
                )
                .inverse();
                let start_mouse_position_clip_space =
                    get_clip_space_mouse_position(event.clone(), &view_element);
                let start_mouse_position =
                    start_in_view_projection_matrix * start_mouse_position_clip_space.to_hom();

                (*self_handler).borrow_mut().is_panning = true;
                (*self_handler).borrow_mut().start_camera = camera;
                (*self_handler).borrow_mut().start_mouse_position = start_mouse_position.xy();
                (*self_handler).borrow_mut().start_in_view_projection_matrix =
                    start_in_view_projection_matrix;
            })
        };
        let mouseup = {
            let self_handler = Rc::clone(&handler);
            Callback::from(move |_event: Event| {
                (*self_handler).borrow_mut().is_panning = false;
            })
        };
        let _mouseleave = {
            let self_handler = Rc::clone(&handler);
            Callback::from(move |_event: Event| {
                (*self_handler).borrow_mut().is_panning = false;
            })
        };
        let mouseenter = {
            let self_handler = Rc::clone(&handler);
            Callback::from(move |_event: Event| {
                // if mouse is up, then we're not panning
                if !(*self_handler).borrow().is_panning {
                    return;
                }
                let event = _event
                    .dyn_ref::<web_sys::MouseEvent>()
                    .expect("Unable to cast event to MouseEvent");
                if event.buttons() == 0 {
                    (*self_handler).borrow_mut().is_panning = false;
                }
            })
        };
        let mousemove = {
            let view_element = view_element.clone();
            let view_context = Rc::clone(&view_context);
            let self_handler = Rc::clone(&handler);

            Callback::from(move |event: Event| {
                if !self_handler.borrow().is_panning {
                    return;
                }

                let event = event
                    .dyn_ref::<web_sys::MouseEvent>()
                    .expect("Unable to cast event to MouseEvent");
                let camera = view_context.get_camera_for_view(view_id);
                let mouse_position_clip_space =
                    get_clip_space_mouse_position(event.clone(), &view_element);
                let mouse_position = (self_handler.borrow().start_in_view_projection_matrix
                    * mouse_position_clip_space.to_hom())
                .xy();

                let translation = self_handler.borrow().start_camera.translation
                    + (self_handler.borrow().start_mouse_position - mouse_position);

                let new_camera = camera::Camera {
                    translation,
                    ..camera
                };

                view_context.set_camera_for_view(view_id, new_camera);
            })
        };

        let options = EventListenerOptions::enable_prevent_default();
        vec![
            EventListener::new_with_options(&view_element, "mousedown", options, move |e| {
                mousedown.emit(e.clone())
            }),
            EventListener::new_with_options(&view_element, "mouseup", options, move |e| {
                mouseup.emit(e.clone())
            }),
            EventListener::new_with_options(&view_element, "mousemove", options, move |e| {
                mousemove.emit(e.clone())
            }),
            // EventListener::new_with_options(&view_element, "mouseleave", options, move |e| {
            //     mouseleave.emit(e.clone())
            // }),
            EventListener::new_with_options(&view_element, "mouseenter", options, move |e| {
                mouseenter.emit(e.clone())
            }),
        ]
    }
}

pub(crate) struct ZoomHandler {}

impl ZoomHandler {
    pub(crate) fn install(view_id: ViewId, view_context: Rc<dyn ViewContext>) -> EventListener {
        let view_element = view_context.get_view_element(view_id);

        let wheel = {
            let view_context = Rc::clone(&view_context);

            Callback::from({
                let view_element = view_element.clone();
                move |event: Event| {
                    let event = event
                        .dyn_ref::<web_sys::WheelEvent>()
                        .expect("Unable to cast event to WheelEvent");
                    if event.shift_key() {
                        return;
                    }

                    event.prevent_default();

                    let html_element_size = Size {
                        width: view_element.client_width() as f32,
                        height: view_element.client_height() as f32,
                    };
                    let element_size = Size {
                        width: view_element.client_width() as f32,
                        height: view_element.client_height() as f32,
                    };
                    let camera = view_context.get_camera_for_view(view_id);
                    let image_size = match view_context.get_image_size_for_view(view_id) {
                        Some(it) => it,
                        None => return,
                    };
                    let aspect_ratio = image_size.width as f32 / image_size.height as f32;

                    let view_projection = camera::calculate_view_projection(
                        &element_size,
                        &VIEW_SIZE,
                        &camera,
                        aspect_ratio,
                    );
                    let view_projection_matrix_inv = view_projection.inverse();
                    let image_size = match view_context.get_image_size_for_view(view_id) {
                        Some(it) => it,
                        None => return,
                    };
                    let pixels_info = calculate_pixels_information(
                        &image_size,
                        &view_projection,
                        &html_element_size,
                    );

                    let invert_scroll_direction = Dispatch::<AppState>::global()
                        .get()
                        .configuration
                        .invert_scroll_direction;
                    let delta_y =
                        event.delta_y() * if invert_scroll_direction { -1.0 } else { 1.0 };
                    if pixels_info.image_pixel_size_device > MAX_PIXEL_SIZE_DEVICE && delta_y > 0.0
                    {
                        return;
                    }

                    let clip_coordinates = get_clip_space_mouse_position(
                        event.clone().dyn_into().unwrap(),
                        &view_element,
                    );

                    let pre_zoom_position =
                        (view_projection_matrix_inv * clip_coordinates.to_hom()).xy();

                    let new_zoom = camera.zoom * (f32::powf(2.0, delta_y as f32 / 100.0));
                    let new_zoom = f32::max(new_zoom, 0.5);

                    let new_camera = camera::Camera {
                        zoom: new_zoom,
                        ..camera
                    };

                    let view_projection_matrix_inv = camera::calculate_view_projection(
                        &element_size,
                        &VIEW_SIZE,
                        &new_camera,
                        aspect_ratio,
                    )
                    .inverse();
                    let post_zoom_position =
                        (view_projection_matrix_inv * clip_coordinates.to_hom()).xy();

                    let translation = camera.translation + (pre_zoom_position - post_zoom_position);

                    let new_camera = camera::Camera {
                        translation,
                        ..new_camera
                    };

                    view_context.set_camera_for_view(view_id, new_camera);
                }
            })
        };

        let options = EventListenerOptions::enable_prevent_default();
        EventListener::new_with_options(&view_element, "wheel", options, move |e| {
            wheel.emit(e.clone())
        })
    }
}

pub(crate) struct PixelHoverHandler;

impl PixelHoverHandler {
    pub(crate) fn install(
        view_id: ViewId,
        view_context: Rc<dyn ViewContext>,
        callback: Callback<Option<UVec2>>,
    ) -> Vec<EventListener> {
        let view_element = view_context.get_view_element(view_id);

        let mousemove = {
            let view_context = Rc::clone(&view_context);
            let view_element = view_element.clone();
            let callback = callback.clone();

            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::MouseEvent>()
                    .expect("Unable to cast event to MouseEvent");
                let image_size = match view_context.get_image_size_for_view(view_id) {
                    Some(it) => it,
                    None => return,
                };
                let aspect_ratio = image_size.width as f32 / image_size.height as f32;

                let camera = view_context.get_camera_for_view(view_id);
                let element_size = Size {
                    width: view_element.client_width() as f32,
                    height: view_element.client_height() as f32,
                };

                let clip_coordinates = get_clip_space_mouse_position(event.clone(), &view_element);

                let view_projection = camera::calculate_view_projection(
                    &element_size,
                    &VIEW_SIZE,
                    &camera,
                    aspect_ratio,
                );
                let view_projection_matrix_inv = view_projection.inverse();
                let image_size = match view_context.get_image_size_for_view(view_id) {
                    Some(it) => it,
                    None => return,
                };

                let mouse_position = view_projection_matrix_inv * clip_coordinates.to_hom();

                let mouse_position_pixels = Vec2::new(
                    mouse_position.x * image_size.width as f32,
                    mouse_position.y * image_size.height as f32,
                );
                let mouse_position_pixels = mouse_position_pixels.floor();

                if mouse_position_pixels.x < 0.0
                    || mouse_position_pixels.y < 0.0
                    || mouse_position_pixels.x >= image_size.width as f32
                    || mouse_position_pixels.y >= image_size.height as f32
                {
                    callback.emit(None);
                } else {
                    callback.emit(Some(UVec2::new(
                        mouse_position_pixels.x as u32,
                        mouse_position_pixels.y as u32,
                    )));
                }
            })
        };

        let mouseleave = {
            let callback = callback.clone();
            Callback::from(move |_event: Event| {
                callback.emit(None);
            })
        };

        vec![
            EventListener::new(&view_element, "mousemove", move |e| {
                mousemove.emit(e.clone())
            }),
            EventListener::new(&view_element, "mouseleave", move |e| {
                mouseleave.emit(e.clone())
            }),
        ]
    }
}

pub(crate) struct ShiftScrollHandler;

impl ShiftScrollHandler {
    pub(crate) fn install(view_id: ViewId, view_context: Rc<dyn ViewContext>) -> EventListener {
        let view_element = view_context.get_view_element(view_id);

        let wheel = {
            let view_context = Rc::clone(&view_context);
            let view_element = view_element.clone();

            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::WheelEvent>()
                    .expect("Unable to cast event to WheelEvent");
                if !event.shift_key() {
                    return;
                }

                event.prevent_default();

                if let Some(cv) = view_context.get_currently_viewing_for_view(view_id) {
                    let amount = event.delta_y() as i32;
                    let dispatch = Dispatch::<AppState>::global();
                    dispatch.apply(ChangeImageAction::ViewShiftScroll(cv, amount));
                }
            })
        };

        let options = EventListenerOptions::enable_prevent_default();
        EventListener::new_with_options(&view_element, "wheel", options, move |e| {
            wheel.emit(e.clone())
        })
    }
}
