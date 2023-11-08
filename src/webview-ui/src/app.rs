use base64::engine::general_purpose;
use base64::Engine;
use gloo_utils::format::JsValueSerdeExt;

use std::cell::RefCell;
use std::rc::Rc;
use stylist::yew::use_style;
use vscode::WebviewApi;

use web_sys::HtmlCanvasElement;
use web_sys::HtmlElement;

use web_sys::WebGl2RenderingContext;

use wasm_bindgen::prelude::*;
use yew::prelude::*;

use crate::communication::incoming_messages::IncomingMessage;
use crate::communication::incoming_messages::SetImageMessage;
use crate::communication::message_handler::install_incoming_message_handler;
use crate::communication::message_handler::IncomeMessageHandler;
use crate::communication::message_handler::OutgoingMessageSender;
use crate::communication::outgoing_messages::OutgoingMessage;
use crate::communication::outgoing_messages::RequestImageMessage;

use crate::components::GLView;

use crate::components::image_list_item::ImageEntry;
use crate::components::image_list_item::ImageInfo;
use crate::components::image_list_item::ImageListItem;
use crate::components::image_selection_list::ImageSelectionList;
use crate::components::main::Main;
use crate::components::set_image_into_view_button::SetImageIntoViewButton;
use crate::configurations;
use crate::image_view;
use crate::image_view::camera::ViewsCameras;
use crate::image_view::image_cache::ImageCache;
use crate::image_view::image_views::ImageViews;
use crate::image_view::renderer::Renderer;
use crate::image_view::rendering_context::CameraContext;
use crate::image_view::rendering_context::ImageViewData;
use crate::image_view::rendering_context::RenderingContext;
use crate::image_view::types::ImageId;
use crate::image_view::types::InSingleViewName;
use crate::image_view::types::InViewName;
use crate::image_view::types::TextureImage;
use crate::mouse_events::PanHandler;
use crate::mouse_events::ZoomHandler;
use crate::vscode;

fn create_image_for_view(gl: &WebGl2RenderingContext) -> Result<TextureImage, String> {
    let data = [
        0u8, 0, 0, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1,
        153, 217, 234, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76,
        1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 34, 177, 76, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1,
        34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34,
        177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242,
        0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200, 191,
        231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 200, 191,
        231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 200,
        191, 231, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34,
        177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28,
        36, 1, 237, 28, 36, 1, 34, 177, 76, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34,
        177, 76, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217,
        234, 1, 153, 217, 234, 1, 237, 28, 36, 1, 34, 177, 76, 1, 237, 28, 36, 1, 237, 28, 36, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 0, 0, 0, 1, 0, 0, 0, 1, 255, 255, 255, 1, 34, 177, 76,
        1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177, 76, 1, 185, 122, 87, 1, 237, 28, 36, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 0, 0, 0, 1, 34, 177, 76, 1, 200, 191, 231, 1, 200, 191, 231,
        1, 200, 191, 231, 1, 34, 177, 76, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 200, 191, 231, 1, 200, 191, 231, 1, 34, 177,
        76, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1,
        185, 122, 87, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1,
        34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        34, 177, 76, 1, 63, 72, 204, 1, 0, 0, 0, 1, 34, 177, 76, 1, 185, 122, 87, 1, 185, 122, 87,
        1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1,
        153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63,
        72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87,
        1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 237, 28, 36, 1, 153, 217, 234, 1,
        153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72,
        204, 1, 34, 177, 76, 1, 0, 0, 0, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185, 122, 87, 1, 185,
        122, 87, 1, 237, 28, 36, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217,
        234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174,
        201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174,
        201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 127, 127, 127, 1,
        127, 127, 127, 1, 0, 0, 0, 1, 185, 122, 87, 1, 237, 28, 36, 1, 237, 28, 36, 1, 255, 242, 0,
        1, 255, 242, 0, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1,
        34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63,
        72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 0, 0, 0, 1,
        237, 28, 36, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 153, 217,
        234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174,
        201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174,
        201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1,
        34, 177, 76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 237, 28, 36, 1, 0, 0, 0, 1, 0, 0, 0, 1,
        255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153,
        217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34,
        177, 76, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 127, 127, 127,
        1, 237, 28, 36, 1, 255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 255, 242, 0, 1,
        255, 242, 0, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34,
        177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255,
        174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 34, 177, 76, 1, 63, 72, 204, 1, 63, 72,
        204, 1, 63, 72, 204, 1, 34, 177, 76, 1, 237, 28, 36, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        255, 242, 0, 1, 255, 242, 0, 1, 0, 0, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 237, 28, 36, 1,
        153, 217, 234, 1, 153, 217, 234, 1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        34, 177, 76, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34, 177,
        76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 237, 28, 36, 1, 153, 217, 234, 1, 153, 217, 234,
        1, 153, 217, 234, 1, 34, 177, 76, 1, 255, 174, 201, 1, 255, 174, 201, 1, 255, 174, 201, 1,
        255, 174, 201, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242,
        0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 34, 177, 76, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 34, 177, 76, 1, 237, 28,
        36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 237, 28, 36, 1, 127, 127, 127, 1, 127, 127, 127, 1,
        34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242,
        0, 1, 34, 177, 76, 1, 34, 177, 76, 1, 34, 177, 76, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1,
        63, 72, 204, 1, 34, 177, 76, 1, 34, 177, 76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 127,
        127, 127, 1, 127, 127, 127, 1, 34, 177, 76, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0,
        1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 63, 72, 204, 1, 34, 177,
        76, 1, 127, 127, 127, 1, 127, 127, 127, 1, 127, 127, 127, 1, 127, 127, 127, 1, 34, 177, 76,
        1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255,
        242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
        255, 242, 0, 1, 255, 242, 0, 1, 255, 242, 0, 1,
    ];
    // let solid_image_data =
    //     image::ImageBuffer::from_fn(256, 256, |x, y| image::Rgba([255u8, 255, 0, 255]));
    let data_vec = data.to_vec();
    let solid_image_data = image::ImageBuffer::from_raw(25, 25, data_vec).unwrap();
    let solid_image = image::DynamicImage::ImageRgba8(solid_image_data);

    TextureImage::try_new(solid_image, gl)
}

struct Coordinator {
    pub gl: RefCell<Option<WebGl2RenderingContext>>,
    pub renderer: RefCell<Renderer>,
    configuration: configurations::Configuration,
    pub texture_image_cache: RefCell<ImageCache>,
    pub image_views: RefCell<ImageViews>,
    views_cameras: RefCell<ViewsCameras>,
    vscode: WebviewApi,
}

impl RenderingContext for Coordinator {
    fn gl(&self) -> WebGl2RenderingContext {
        self.gl
            .borrow()
            .as_ref()
            .expect("GL context not set")
            .clone()
    }

    fn texture_by_id(&self, id: &ImageId) -> Option<Rc<TextureImage>> {
        self.texture_image_cache.borrow().get(id).map(Rc::clone)
    }

    fn visible_nodes(&self) -> Vec<InViewName> {
        self.image_views.borrow().visible_views()
    }

    fn view_data(&self, view_id: InViewName) -> ImageViewData {
        ImageViewData {
            camera: self.views_cameras.borrow().get(view_id),
            html_element: self
                .image_views
                .borrow()
                .get_node_ref(view_id)
                .cast::<HtmlElement>()
                .unwrap_or_else(|| {
                    panic!(
                        "Unable to cast node ref to HtmlElement for view {:?}",
                        view_id
                    )
                }),
            image_id: self.image_views.borrow().get_image_id(view_id),
        }
    }

    fn rendering_configuration(&self) -> &configurations::RenderingConfiguration {
        &self.configuration.rendering
    }
}

impl CameraContext for Coordinator {
    fn get_camera_for_view(&self, view_id: InViewName) -> image_view::camera::Camera {
        self.views_cameras.borrow().get(view_id)
    }

    fn set_camera_for_view(&self, view_id: InViewName, camera: image_view::camera::Camera) {
        self.views_cameras.borrow_mut().set(view_id, camera);
    }
}

impl IncomeMessageHandler for Coordinator {
    fn handle_incoming_message(&self, message: IncomingMessage) {
        let handle_set_image_message = |message: SetImageMessage| {
            let bytes = general_purpose::STANDARD
                .decode(message.image_base64)
                .unwrap();
            let image =
                image::load_from_memory_with_format(&bytes, image::ImageFormat::Png).unwrap();
            let _width = image.width();
            let _height = image.height();
            let _channels = image.color().channel_count();

            // TODO: remove this
            let image = image::DynamicImage::ImageRgba8(image.to_rgba8());

            let image = TextureImage::try_new(image, self.gl.borrow().as_ref().unwrap())
                .expect("Unable to create texture image");

            let image_id = self.texture_image_cache.borrow_mut().add(image);

            let view_id = InViewName::Single(InSingleViewName::Single);

            self.image_views
                .borrow_mut()
                .set_image_to_view(image_id, view_id);
        };

        match message {
            IncomingMessage::SetImageMessage(msg) => handle_set_image_message(msg),
        }
    }
}

impl OutgoingMessageSender for Coordinator {
    fn send_message(&self, message: OutgoingMessage) {
        self.vscode
            .post_message(JsValue::from_serde(&message).unwrap());
    }
}

#[function_component]
pub fn App() -> Html {
    let coordinator = use_memo((), {
        |_| Coordinator {
            gl: RefCell::new(None),
            renderer: RefCell::new(Renderer::new()),
            configuration: configurations::Configuration::default(),
            texture_image_cache: RefCell::new(ImageCache::new()),
            image_views: RefCell::new(ImageViews::new()),
            views_cameras: RefCell::new(ViewsCameras::new()),
            vscode: vscode::acquire_vscode_api(),
        }
    });

    let canvas_ref = use_node_ref();

    // TODO: move from here
    let view_id = InViewName::Single(InSingleViewName::Single);
    let my_node_ref = coordinator.image_views.borrow().get_node_ref(view_id);

    use_effect({
        let coordinator = Rc::clone(&coordinator);
        let canvas_ref = canvas_ref.clone();
        let my_node_ref = my_node_ref.clone();

        move || {
            let message_listener = install_incoming_message_handler(
                Rc::clone(&coordinator) as Rc<dyn IncomeMessageHandler>
            );

            let zoom_listener = {
                let canvas_ref = canvas_ref.clone();
                let view_element = my_node_ref
                    .cast::<HtmlElement>()
                    .expect("Unable to cast node ref to HtmlElement");
                ZoomHandler::install(
                    canvas_ref,
                    view_id,
                    &view_element,
                    Rc::clone(&coordinator) as Rc<dyn CameraContext>,
                )
            };

            let pan_listener = {
                let canvas_ref = canvas_ref.clone();
                let view_element = my_node_ref
                    .cast::<HtmlElement>()
                    .expect("Unable to cast node ref to HtmlElement");
                PanHandler::install(
                    canvas_ref,
                    view_id,
                    &view_element,
                    Rc::clone(&coordinator) as Rc<dyn CameraContext>,
                )
            };

            move || {
                drop(message_listener);
                drop(zoom_listener);
                drop(pan_listener);
            }
        }
    });

    use_effect_with(canvas_ref.clone(), {
        let coordinator = Rc::clone(&coordinator);
        move |canvas_ref: &NodeRef| {
            let canvas = canvas_ref
                .cast::<HtmlCanvasElement>()
                .expect("canvas_ref not attached to a canvas element");

            let gl: WebGl2RenderingContext = canvas
                .get_context("webgl2")
                .unwrap()
                .unwrap()
                .dyn_into()
                .unwrap();

            log::debug!("GL context created");

            coordinator.gl.replace(Some(gl.clone()));

            coordinator
                .renderer
                .borrow_mut()
                .set_rendering_context(coordinator.clone());

            // TODO: remove. debug thing
            if let Err(err) = create_image_for_view(&gl)
                .map(|image| coordinator.texture_image_cache.borrow_mut().add(image))
                .map(|id| {
                    coordinator.image_views.borrow_mut().set_image_to_view(
                        id,
                        image_view::types::InViewName::Single(
                            image_view::types::InSingleViewName::Single,
                        ),
                    )
                })
            {
                log::error!("Error creating image: {:?}", err);
            }

            move || {
                coordinator.gl.replace(None);
            }
        }
    });

    // let onclick_get_image = Callback::from({
    //     let coordinator = Rc::clone(&coordinator);
    //     move |_| {
    //         coordinator.send_message(OutgoingMessage::RequestImageMessage(RequestImageMessage {}));
    //     }
    // });

    // let onclick_view_image = Callback::from({
    //     // let renderer = coordinator.renderer.clone();
    //     move |_| {
    //         // (*renderer.borrow_mut())
    //         //     .put_image_to_view(InViewName::Single(InSingleViewName::Single), "test")
    //     }
    // });

    let main_style = use_style!(
        r#"
        /* make sure we don't overflow, so no scroll bar.
         TODO: find the best value for this, or a better way to do this
         */
        width: 95vw;
        height: 90vh;
        margin: 0;
        padding: 0;
    "#,
    );
    let canvas_style = use_style!(
        r#"
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
    "#,
    );

    let image_view_container_style = use_style!(
        r#"
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        justify-content: center;
        align-items: center;
    "#,
    );

    let num_entries = 2;
    let entries = (0..num_entries)
        .map(|i| ImageEntry {
            name: format!("My image {}", i),
            info: ImageInfo {
                shape: vec![256, 256, 4],
                data_type: "u8".to_string(),
            },
        })
        .collect::<Vec<_>>();

    html! {
        <div class={main_style}>
            <canvas id="gl-canvas" ref={canvas_ref} class={canvas_style}></canvas>
            <Main />
            // <vscode-button onclick={onclick_get_image}> {"Get image"} </vscode-button>
            // <vscode-button onclick={onclick_view_image}> {"View image"} </vscode-button>
            // <vscode-panels>
            //     <vscode-panel-tab id="tab-1">
            //         {"PROBLEMS"}
            //     </vscode-panel-tab>
            //     <vscode-panel-tab id="tab-2">
            //         {"OUTPUT"}
            //     </vscode-panel-tab>
            //     <vscode-panel-tab id="tab-3">
            //         {"DEBUG CONSOLE"}
            //     </vscode-panel-tab>
            //     <vscode-panel-tab id="tab-4">
            //         {"TERMINAL"}
            //     </vscode-panel-tab>
            //     <vscode-panel-view id="view-1"> {"Problems Content"} </vscode-panel-view>
            //     <vscode-panel-view id="view-2"> {"Output Content"} </vscode-panel-view>
            //     <vscode-panel-view id="view-3"> {"Debug Console Content"} </vscode-panel-view>
            //     <vscode-panel-view id="view-4"> {"Terminal Content"} </vscode-panel-view>
            // </vscode-panels>
            // <div>{ "Hello World!" }</div>
            // <ImageSelectionList images={ entries }/>
            <div class={image_view_container_style}>
                <GLView node_ref={my_node_ref} />
            </div>
        </div>
    }
}
