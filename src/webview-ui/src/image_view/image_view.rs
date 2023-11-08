use std::rc::Rc;

use yew::NodeRef;

use super::{camera::Camera, types::ImageId};

#[derive(Clone)]
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

#[derive(Clone)]
pub struct ImageViewModel {
    pub image_id: Option<ImageId>,
    pub bg_color: Option<[f32; 4]>,
    parameters: ImageViewParameters,
}

impl ImageViewModel {
    pub fn new() -> Self {
        Self {
            image_id: None,
            bg_color: Some([0.0, 0.0, 1.0, 1.0]), // TODO: remove this
            parameters: ImageViewParameters::default(),
        }
    }

    pub fn set_image_id(&mut self, image_id: ImageId) {
        self.image_id = Some(image_id);
    }
}

#[derive(Clone)]
pub struct ImageView {
    pub model: ImageViewModel,
    pub node_ref: NodeRef,
}
