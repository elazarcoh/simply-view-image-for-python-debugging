use std::rc::Rc;

use web_sys::{HtmlElement, WebGl2RenderingContext};

use crate::configurations::RenderingConfiguration;

use super::{
    camera::Camera,
    types::{ImageId, ViewId, TextureImage},
};

pub struct ImageViewData {
    pub html_element: HtmlElement,
    pub image_id: Option<ImageId>,
    pub camera: Camera,
}

pub trait RenderingContext {
    fn gl(&self) -> WebGl2RenderingContext;
    fn visible_nodes(&self) -> Vec<ViewId>;
    fn texture_by_id(&self, id: &ImageId) -> Option<Rc<TextureImage>>;
    fn view_data(&self, view_id: ViewId) -> ImageViewData;
    fn rendering_configuration(&self) -> RenderingConfiguration;
    fn coloring_matrix(&self, image_id: &ImageId) -> glam::Mat4;
}

pub trait CameraContext {
    fn get_camera_for_view(&self, view_id: ViewId) -> Camera;
    fn set_camera_for_view(&self, view_id: ViewId, camera: Camera);
}