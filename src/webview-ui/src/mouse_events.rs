use std::{borrow::BorrowMut, cell::RefCell, rc::Rc};

use glam::{Mat3, Vec2, Vec3Swizzles};
use gloo::events::{EventListener, EventListenerOptions};
use wasm_bindgen::JsCast;
use web_sys::{Element, Event, HtmlCanvasElement, MouseEvent};
use yew::{Callback, NodeRef};

use crate::{
    common::Size,
    image_view::{
        camera::{self, Camera},
        rendering_context::CameraContext,
        types::InViewName,
    },
    math_utils::ToHom,
};

fn get_clip_space_mouse_position(e: MouseEvent, canvas: &web_sys::HtmlCanvasElement) -> Vec2 {
    // get canvas relative css position
    let rect = canvas.get_bounding_client_rect();
    let css_x = e.client_x() as f32 - rect.left() as f32;
    let css_y = e.client_y() as f32 - rect.top() as f32;

    // get normalized 0 to 1 position across and down canvas
    let normalized_x = css_x / canvas.client_width() as f32;
    let normalized_y = css_y / canvas.client_height() as f32;

    // convert to clip space
    let clip_x = normalized_x * 2.0 - 1.0;
    let clip_y = normalized_y * -2.0 + 1.0;

    [clip_x, clip_y].into()
}

pub struct PanHandler {
    is_panning: bool,
    start_camera: Camera,
    start_in_view_projection_matrix: Mat3,
    start_mouse_position: Vec2,
}

impl PanHandler {
    fn new() -> Self {
        Self {
            is_panning: false,
            start_camera: Camera::default(),
            start_in_view_projection_matrix: Mat3::IDENTITY,
            start_mouse_position: [0.0, 0.0].into(),
        }
    }

    pub fn install(
        canvas_ref: NodeRef,
        view_id: InViewName,
        view_element: &web_sys::HtmlElement,
        camera_context: Rc<dyn CameraContext>,
    ) -> (EventListener, EventListener, EventListener, EventListener) {
        let handler = Rc::new(RefCell::new(Self::new()));

        let mousedown = {
            let canvas_element = canvas_ref
                .cast::<HtmlCanvasElement>()
                .expect("canvas_ref not attached to a canvas element");
            let camera_context = Rc::clone(&camera_context);
            let self_handler = Rc::clone(&handler);
            Callback::from(move |event: Event| {
                let event = event
                    .dyn_ref::<web_sys::MouseEvent>()
                    .expect("Unable to cast event to MouseEvent");
                let camera = camera_context.get_camera_for_view(view_id);
                let canvas_size = Size {
                    width: canvas_element.width() as f32,
                    height: canvas_element.height() as f32,
                };
                let view_size = Size {
                    width: 1.0,
                    height: 1.0,
                };

                let start_in_view_projection_matrix =
                    camera::calculate_view_projection(&canvas_size, &view_size, &camera).inverse();
                let start_mouse_position_clip_space =
                    get_clip_space_mouse_position(event.clone(), &canvas_element);
                let start_mouse_position =
                    (start_in_view_projection_matrix * start_mouse_position_clip_space.to_hom());

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
        let mouseleave = {
            let self_handler = Rc::clone(&handler);
            Callback::from(move |_event: Event| {
                (*self_handler).borrow_mut().is_panning = false;
            })
        };
        let mousemove = {
            let canvas_element = canvas_ref
                .cast::<HtmlCanvasElement>()
                .expect("canvas_ref not attached to a canvas element");
            let camera_context = Rc::clone(&camera_context);
            let self_handler = Rc::clone(&handler);

            Callback::from(move |event: Event| {
                if !self_handler.borrow().is_panning {
                    return;
                }

                let event = event
                    .dyn_ref::<web_sys::MouseEvent>()
                    .expect("Unable to cast event to MouseEvent");
                let camera = camera_context.get_camera_for_view(view_id);
                let mouse_position_clip_space =
                    get_clip_space_mouse_position(event.clone(), &canvas_element);
                let mouse_position = (self_handler.borrow().start_in_view_projection_matrix
                    * mouse_position_clip_space.to_hom())
                .xy();

                let translation = self_handler.borrow().start_camera.translation
                    + (self_handler.borrow().start_mouse_position - mouse_position);

                let new_camera = Camera {
                    translation,
                    ..camera
                };

                camera_context.set_camera_for_view(view_id, new_camera);
            })
        };

        let options = EventListenerOptions::enable_prevent_default();
        (
            EventListener::new_with_options(&view_element, "mousedown", options, move |e| {
                mousedown.emit(e.clone())
            }),
            EventListener::new_with_options(&view_element, "mouseup", options, move |e| {
                mouseup.emit(e.clone())
            }),
            EventListener::new_with_options(&view_element, "mousemove", options, move |e| {
                mousemove.emit(e.clone())
            }),
            EventListener::new_with_options(&view_element, "mouseleave", options, move |e| {
                mouseleave.emit(e.clone())
            }),
        )
    }
}

pub struct ZoomHandler {}

impl ZoomHandler {
    fn new() -> Self {
        Self {}
    }

    pub fn install(
        canvas_ref: NodeRef,
        view_id: InViewName,
        view_element: &web_sys::HtmlElement,
        camera_context: Rc<dyn CameraContext>,
    ) -> EventListener {
        let handler = Rc::new(RefCell::new(Self::new()));

        let wheel = {
            let canvas_element = canvas_ref
                .cast::<HtmlCanvasElement>()
                .expect("canvas_ref not attached to a canvas element");
            let camera_context = Rc::clone(&camera_context);
            let self_handler = Rc::clone(&handler);
            Callback::from(move |event: Event| {
                event.prevent_default();
                let event = event
                    .dyn_ref::<web_sys::WheelEvent>()
                    .expect("Unable to cast event to WheelEvent");
                let camera = camera_context.get_camera_for_view(view_id);

                let clip_coordinates =
                    get_clip_space_mouse_position(event.clone().dyn_into().unwrap(), &canvas_element);

                let canvas_size = Size {
                    width: canvas_element.width() as f32,
                    height: canvas_element.height() as f32,
                };
                let view_size = Size {
                    width: 1.0,
                    height: 1.0,
                };
                let view_projection_matrix_inv =
                    camera::calculate_view_projection(&canvas_size, &view_size, &camera).inverse();
                let pre_zoom_position =
                    (view_projection_matrix_inv * clip_coordinates.to_hom()).xy();

                let delta_y = event.delta_y();
                let new_zoom = camera.zoom * (f32::powf(2.0, delta_y as f32 / 100.0));
                let new_zoom = f32::clamp(new_zoom, 0.8, 10.0); // TODO: make these configurable

                let new_camera = Camera {
                    zoom: new_zoom,
                    ..camera
                };

                let view_projection_matrix_inv =
                    camera::calculate_view_projection(&canvas_size, &view_size, &new_camera)
                        .inverse();
                let post_zoom_position =
                    (view_projection_matrix_inv * clip_coordinates.to_hom()).xy();

                let translation = camera.translation + (pre_zoom_position - post_zoom_position);

                let new_camera = Camera {
                    translation,
                    ..new_camera
                };

                camera_context.set_camera_for_view(view_id, new_camera);
            })
        };

        let options = EventListenerOptions::enable_prevent_default();
        EventListener::new_with_options(&view_element, "wheel", options, move |e| {
            wheel.emit(e.clone())
        })
    }
}
