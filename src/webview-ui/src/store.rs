use std::{collections::HashMap, fmt::Debug, rc::Rc};

use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

use crate::{
    communication::message_handler::OutgoingMessageSender,
    configurations,
    image_view::{
        camera::ViewsCameras,
        image_cache::ImageCache,
        image_views::ImageViews,
        types::{ImageId, ViewId},
    },
};

// TODO: Move this to a separate file
#[derive(Clone, Debug, PartialEq)]
pub enum ValueVariableKind {
    Variable,
    Expression,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ImageInfo {
    pub expression: String,
    pub shape: Vec<u32>,
    pub data_type: String,
    pub value_variable_kind: ValueVariableKind,
}

#[derive(Debug)]
pub struct ImageData {
    pub info: ImageInfo,
}

impl ImageData {
    pub fn new(info: ImageInfo) -> Self {
        Self { info }
    }
}

#[derive(Default)]
pub struct Images {
    pub image_ids: Vec<ImageId>,
    pub by_id: HashMap<ImageId, ImageData>,
}

#[derive(Store, Clone)]
pub struct AppState {
    pub gl: Option<WebGl2RenderingContext>,

    pub images: Mrc<Images>,
    image_views: Mrc<ImageViews>,
    pub image_cache: Mrc<ImageCache>,

    pub view_cameras: Mrc<ViewsCameras>,

    pub message_service: Option<Rc<dyn OutgoingMessageSender>>,

    pub configuration: configurations::Configuration,
}

impl AppState {
    pub fn image_views(&self) -> Mrc<ImageViews> {
        self.image_views.clone()
    }

    pub fn set_image_to_view(&mut self, image_id: ImageId, view_id: ViewId) {
        self.image_views
            .borrow_mut()
            .set_image_to_view(image_id, view_id);
    }
}

impl Default for AppState {
    fn default() -> Self {
        log::debug!("AppState::default");
        Self {
            gl: None,
            images: Default::default(),
            image_views: Default::default(),
            image_cache: Default::default(),
            view_cameras: Default::default(),
            message_service: Default::default(),
            configuration: Default::default(),
        }
    }
}

impl PartialEq for AppState {
    fn eq(&self, other: &Self) -> bool {
        self.images == other.images
            && self.image_views == other.image_views
            && self.image_cache == other.image_cache
            && self.view_cameras == other.view_cameras
            && self.configuration == other.configuration
            && (self.message_service.is_none() && other.message_service.is_none()
                || (self.message_service.is_some()
                    && other.message_service.is_some()
                    && Rc::ptr_eq(
                        self.message_service.as_ref().unwrap(),
                        other.message_service.as_ref().unwrap(),
                    )))
            && self.gl == other.gl
    }
}
