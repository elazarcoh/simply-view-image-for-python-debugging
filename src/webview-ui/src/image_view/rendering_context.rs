use std::rc::Rc;

use web_sys::{HtmlElement, WebGl2RenderingContext};

use crate::{configurations::RenderingConfiguration, webgl_utils, common::Size};

use super::{
    camera::Camera,
    types::{DrawingOptions, ImageId, TextureImage, ViewId},
};

pub(crate) struct ImageViewData {
    pub html_element: HtmlElement,
    pub image_id: Option<ImageId>,
    pub camera: Camera,
}

pub(crate) trait RenderingContext {
    fn gl(&self) -> WebGl2RenderingContext;
    fn visible_nodes(&self) -> Vec<ViewId>;
    fn texture_by_id(&self, id: &ImageId) -> Option<Rc<TextureImage>>;
    fn view_data(&self, view_id: ViewId) -> ImageViewData;
    fn rendering_configuration(&self) -> RenderingConfiguration;
    fn drawing_options(&self, image_id: &ImageId) -> DrawingOptions;
    fn get_color_map_texture(
        &self,
        colormap_name: &str,
    ) -> Result<Rc<webgl_utils::GLGuard<web_sys::WebGlTexture>>, String>;
}

pub(crate) trait ViewContext {
    fn get_image_size_for_view(&self, view_id: ViewId) -> Option<Size>;
    fn get_camera_for_view(&self, view_id: ViewId) -> Camera;
    fn set_camera_for_view(&self, view_id: ViewId, camera: Camera);
}
