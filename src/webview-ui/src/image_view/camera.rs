use std::{cell::RefCell, collections::HashMap, rc::Rc};

use super::types::{all_views, InViewName};

#[derive(Copy, Clone)]
pub struct Camera {
    translation: glam::Vec2,
    zoom: f32,
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
    pub fn as_matrix(&self) -> glam::Mat3 {
        let zoom_scale = 1.0_f32 / self.zoom;
        glam::Mat3::from_scale_angle_translation(
            glam::Vec2::new(zoom_scale, zoom_scale),
            0.0,
            self.translation,
        )
    }
}

pub struct ViewsCameras(HashMap<InViewName, Rc<RefCell<Camera>>>);

impl ViewsCameras {
    pub fn new() -> Self {
        Self {
            0: all_views()
                .into_iter()
                .map(|v| (v, Rc::new(RefCell::new(Camera::default()))))
                .collect(),
        }
    }
    pub fn get(&self, view_id: InViewName) -> Camera {
        self.0.get(&view_id).unwrap().borrow().to_owned()
    }
}
