use std::{collections::HashMap, fmt::Debug};

use web_sys::WebGl2RenderingContext;
use yewdux::{prelude::*, mrc::Mrc};

use crate::{configurations, image_view::types::{ImageId, TextureImage}};

// TODO: Move this to a separate file
#[derive(Clone, Debug, PartialEq)]
pub enum ValueVariableKind {
    Variable,
    Expression
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
    image: Option<TextureImage>,
    pub info: ImageInfo,
}

impl ImageData {
    pub fn new(info: ImageInfo) -> Self {
        Self {
            image: None,
            info,
        }
    }
}

#[derive(Default)]
pub struct Images {
    pub image_ids: Vec<ImageId>,
    pub by_id: HashMap<ImageId, ImageData>,
}

#[derive(Store, PartialEq, Default, Clone)]
pub struct AppState {
    pub gl: Option<WebGl2RenderingContext>,
    
    pub images: Mrc<Images>,

    pub configuration: configurations::Configuration,

    pub tmp_counter: usize,
}

