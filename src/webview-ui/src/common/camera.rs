use std::{cell::RefCell, collections::HashMap, rc::Rc};

use crate::{common::Size, math_utils};

use super::{constants::all_views, types::ViewId};

#[derive(Copy, Clone)]
pub(crate) struct Camera {
    pub translation: glam::Vec2,
    pub zoom: f32,
}

impl Default for Camera {
    fn default() -> Self {
        Self {
            translation: glam::Vec2::ZERO,
            zoom: 1.0,
        }
    }
}

impl Camera {
    pub(crate) fn as_matrix(&self) -> glam::Mat3 {
        let zoom_scale = 1.0_f32 / self.zoom;
        glam::Mat3::from_scale_angle_translation(
            glam::Vec2::new(zoom_scale, zoom_scale),
            0.0,
            self.translation,
        )
    }
}

pub(crate) struct ViewsCameras(HashMap<ViewId, Rc<RefCell<Camera>>>);

impl ViewsCameras {
    pub(crate) fn new() -> Self {
        Self(
            all_views()
                .into_iter()
                .map(|v| (v, Rc::new(RefCell::new(Camera::default()))))
                .collect(),
        )
    }
    pub(crate) fn get(&self, view_id: ViewId) -> Camera {
        self.0.get(&view_id).unwrap().borrow().to_owned()
    }

    pub(crate) fn set(&mut self, view_id: ViewId, camera: Camera) {
        self.0.get(&view_id).unwrap().replace(camera);
    }

    pub(crate) fn reset_all(&mut self) {
        for (_, camera) in self.0.iter() {
            camera.replace(Camera::default());
        }
    }
}

impl Default for ViewsCameras {
    fn default() -> Self {
        Self::new()
    }
}

pub(crate) fn calculate_view_projection(
    canvas_size: &Size,
    view_size: &Size,
    camera: &Camera,
    aspect_ratio: f32,
) -> glam::Mat3 {
    let canvas_aspect_ratio = canvas_size.width / canvas_size.height;
    let scale = canvas_aspect_ratio / aspect_ratio;

    let camera_matrix = camera.as_matrix();
    let view_matrix = camera_matrix.inverse();

    // make sure the view aspect ratio matches the canvas aspect ratio
    let view_aspect_matrix = if scale > 1.0 {
        glam::Mat3::from_scale(glam::Vec2::new(1.0 / scale, 1.0))
    } else {
        glam::Mat3::from_scale(glam::Vec2::new(1.0, scale))
    };

    let view_projection = math_utils::mat3::projection(view_size.width, view_size.height);
    let canvas_projection = math_utils::mat3::projection(canvas_size.width, canvas_size.height);
    let view_to_canvas = canvas_projection.inverse() * view_projection * view_aspect_matrix;

    let view_size_in_canvas =
        view_to_canvas * glam::Vec3::new(view_size.width, view_size.height, 1.0);
    let view_width_in_canvas = view_size_in_canvas.x;
    let view_height_in_canvas = view_size_in_canvas.y;

    let center_in_canvas_matrix = if scale > 1.0 {
        glam::Mat3::from_translation(glam::Vec2::new(
            (canvas_size.width - view_width_in_canvas) / 2.0,
            0.0,
        ))
    } else {
        glam::Mat3::from_translation(glam::Vec2::new(
            0.0,
            (canvas_size.height - view_height_in_canvas) / 2.0,
        ))
    };

    canvas_projection * center_in_canvas_matrix * view_to_canvas * view_matrix
}
