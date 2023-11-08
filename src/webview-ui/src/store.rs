use std::{collections::HashMap, fmt::Debug, rc::Rc};

use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

use crate::{
    configurations,
    image_view::{
        image_cache::ImageCache,
        image_views::ImageViews,
        types::{ImageId, TextureImage, ViewId},
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

#[derive(Store, PartialEq, Clone)]
pub struct AppState {
    pub gl: Option<WebGl2RenderingContext>,

    pub images: Mrc<Images>,
    image_views: Mrc<ImageViews>,
    pub image_cache: Mrc<ImageCache>,

    pub configuration: configurations::Configuration,
}

impl AppState {
    pub fn image_views(&self) -> Mrc<ImageViews> {
        self.image_views.clone()
    }

    pub fn set_image_to_view(&mut self, image_id: ImageId, view_id: ViewId) {
        self.image_views.borrow_mut().set_image_to_view(image_id, view_id);
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
            configuration: Default::default(),
        }
    }
}
