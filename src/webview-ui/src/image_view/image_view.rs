use std::rc::Rc;

use yew::NodeRef;

use super::camera::Camera;

pub type CameraRef = Rc<Camera>;

pub struct ImageViewModel {
    pub camera_ref: CameraRef,
    pub image_id: Option<String>,
}

impl ImageViewModel {
    pub fn new(camera_ref: CameraRef) -> Self {
        Self {
            camera_ref,
            image_id: None,
        }
    }
}

pub struct ImageView {
    pub model: ImageViewModel,
    pub node_ref: NodeRef,
}
