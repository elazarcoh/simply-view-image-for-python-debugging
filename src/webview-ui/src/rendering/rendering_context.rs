use anyhow::Result;
use std::rc::Rc;

use web_sys::{HtmlElement, WebGl2RenderingContext};

use crate::{
    app_state::app_state::GlobalDrawingOptions,
    colormap::colormap,
    common::{camera, ImageAvailability, ImageId, Size, ViewId},
    configurations::RenderingConfiguration,
    rendering::coloring::DrawingOptions,
    webgl_utils,
};

pub(crate) struct ImageViewData {
    pub html_element: HtmlElement,
    pub image_id: Option<ImageId>,
    pub camera: camera::Camera,
}

pub(crate) trait RenderingContext {
    fn gl(&self) -> WebGl2RenderingContext;
    fn visible_nodes(&self) -> Vec<ViewId>;
    fn texture_by_id(&self, id: &ImageId) -> ImageAvailability;
    fn view_data(&self, view_id: ViewId) -> ImageViewData;
    fn rendering_configuration(&self) -> RenderingConfiguration;
    fn drawing_options(&self, image_id: &ImageId) -> (DrawingOptions, GlobalDrawingOptions);
    fn get_color_map(&self, name: &str) -> Result<Rc<colormap::ColorMap>>;
    fn get_color_map_texture(
        &self,
        colormap_name: &str,
    ) -> Result<Rc<webgl_utils::GLGuard<web_sys::WebGlTexture>>>;
}

pub(crate) trait ViewContext {
    fn get_view_element(&self, view_id: ViewId) -> HtmlElement;
    fn get_image_size_for_view(&self, view_id: ViewId) -> Option<Size>;
    fn get_image_for_view(&self, view_id: ViewId) -> Option<ImageAvailability>;
    fn get_camera_for_view(&self, view_id: ViewId) -> camera::Camera;
    fn set_camera_for_view(&self, view_id: ViewId, camera: camera::Camera);
}
