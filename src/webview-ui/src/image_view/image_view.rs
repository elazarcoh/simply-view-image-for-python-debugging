use std::rc::Rc;

use yew::NodeRef;

use super::camera::Camera;

pub type CameraRef = Rc<Camera>;

pub struct ImageViewModel {
    pub camera_ref: CameraRef,
    pub image_id: Option<String>,
    pub bg_color: Option<[f32; 4]>,
}

impl ImageViewModel {
    pub fn new(camera_ref: CameraRef) -> Self {
        Self {
            camera_ref,
            image_id: None,
            bg_color: Some([0.0, 0.0, 1.0, 1.0]), // TODO: remove this
        }
    }
}

pub struct ImageView {
    pub model: ImageViewModel,
    pub node_ref: NodeRef,
}
