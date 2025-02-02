use anyhow::Result;
use yewdux::mrc::Mrc;
use std::rc::Rc;

use web_sys::{HtmlElement, WebGl2RenderingContext};

use crate::{
    application_state::{app_state::GlobalDrawingOptions, images::ImageAvailability},
    coloring::DrawingOptions,
    colormap,
    common::{
        camera, texture_image::TextureImage, CurrentlyViewing, Size, ViewId, ViewableObjectId,
    },
    configurations::RenderingConfiguration,
    webgl_utils,
};

pub(crate) struct ImageViewData {
    pub html_element: HtmlElement,
    pub currently_viewing: Option<CurrentlyViewing>,
    pub camera: camera::Camera,
}

pub(crate) struct ColorBarData {
    pub html_element: HtmlElement,
    pub drawing_options: DrawingOptions,
    pub global_drawing_options: GlobalDrawingOptions,
    pub texture_image: Mrc<TextureImage>,
}

pub(crate) trait RenderingContext {
    fn gl(&self) -> WebGl2RenderingContext;
    fn visible_nodes(&self) -> Vec<ViewId>;
    fn texture_by_id(&self, id: &ViewableObjectId) -> ImageAvailability;
    fn view_data(&self, view_id: ViewId) -> ImageViewData;
    fn rendering_configuration(&self) -> RenderingConfiguration;
    fn drawing_options(
        &self,
        image_id: &ViewableObjectId,
    ) -> (DrawingOptions, GlobalDrawingOptions);
    fn get_color_map(&self, name: &str) -> Result<Rc<colormap::ColorMap>>;
    fn get_color_map_texture(
        &self,
        colormap_name: &str,
    ) -> Result<Rc<webgl_utils::GLGuard<web_sys::WebGlTexture>>>;
    fn get_colorbar_data(&self, view_id: ViewId) -> Option<ColorBarData>;
}

pub(crate) trait ViewContext {
    fn get_view_element(&self, view_id: ViewId) -> HtmlElement;
    fn get_image_size_for_view(&self, view_id: ViewId) -> Option<Size>;
    fn get_image_for_view(&self, view_id: ViewId) -> Option<ImageAvailability>;
    fn get_currently_viewing_for_view(&self, view_id: ViewId) -> Option<CurrentlyViewing>;
    fn get_camera_for_view(&self, view_id: ViewId) -> camera::Camera;
    fn set_camera_for_view(&self, view_id: ViewId, camera: camera::Camera);
}
