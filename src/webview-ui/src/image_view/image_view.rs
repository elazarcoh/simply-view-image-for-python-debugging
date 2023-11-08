use std::rc::Rc;

use yew::NodeRef;

use super::camera::Camera;

pub type CameraRef = Rc<Camera>;

struct ImageViewParameters {
    pub view_width: u32,
    pub view_height: u32,
    pub image_to_view_transform: glam::Mat4,
}

impl Default for ImageViewParameters {
    fn default() -> Self {
        Self {
            view_width: 100,
            view_height: 100,
            image_to_view_transform: glam::Mat4::IDENTITY,
        }
    }
}

pub struct ImageViewModel {
    pub camera_ref: CameraRef,
    pub image_id: Option<String>,
    pub bg_color: Option<[f32; 4]>,
    parameters: ImageViewParameters,
}

impl ImageViewModel {
    pub fn new(camera_ref: CameraRef) -> Self {
        Self {
            camera_ref,
            image_id: None,
            bg_color: Some([0.0, 0.0, 1.0, 1.0]), // TODO: remove this
            parameters: ImageViewParameters::default(),
        }
    }
}

pub struct ImageView {
    pub model: ImageViewModel,
    pub node_ref: NodeRef,
}
