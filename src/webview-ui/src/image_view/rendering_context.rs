use web_sys::{HtmlElement, WebGl2RenderingContext};

use super::{
    image_view::ImageView,
    types::{ImageId, TextureImage},
};

pub trait RenderingContext {
    fn gl(&self) -> WebGl2RenderingContext;
    fn visible_nodes(&self) -> Vec<(ImageView, HtmlElement)>;
    fn texture_by_id(&self, id: &ImageId) -> Option<&TextureImage>;
}
