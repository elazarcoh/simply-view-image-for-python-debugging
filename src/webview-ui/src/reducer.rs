use std::{borrow::BorrowMut, collections::HashMap, rc::Rc};

use web_sys::WebGl2RenderingContext;
use yewdux::prelude::*;

use crate::{
    communication::incoming_messages::ImageInfo,
    image_view::{types::{ImageId, TextureImage, ViewId, DrawingOptions, Coloring}, colormap::ColorMap},
    store::AppState,
};

pub(crate) enum UpdateDrawingOptions {
    Reset,
    Coloring(Coloring),
    Invert(bool),
    HighContrast(bool),
    IgnoreAlpha(bool)
}

pub(crate) enum StoreAction {
    UpdateImages(Vec<(ImageId, ImageInfo)>), 
    SetImageToView(ImageId, ViewId),
    AddTextureImage(ImageId, Box<TextureImage>),
    UpdateDrawingOptions(ImageId, UpdateDrawingOptions),
}

impl Reducer<AppState> for StoreAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        log::debug!("Reducer for StoreAction called");
        let state = Rc::make_mut(&mut app_state);

        match self {
            StoreAction::UpdateImages(images) => {
                let ids = images.iter().map(|(id, _)| id.clone()).collect::<Vec<_>>();
                let images_hashmap = images.into_iter().collect::<HashMap<_, _>>();
                {
                    let mut mutable = state.images.borrow_mut();
                    mutable.image_ids = ids;
                    mutable.by_id = images_hashmap;
                }
            }

            StoreAction::SetImageToView(image_id, view_id) => {
                log::debug!("SetImageToView: {:?} {:?}", image_id, view_id);
                state.set_image_to_view(image_id, view_id);
            }

            StoreAction::AddTextureImage(image_id, texture_image) => {
                log::debug!("AddTextureImage: {:?}", image_id);
                state.image_cache.borrow_mut().set(&image_id, *texture_image);
            }
            StoreAction::UpdateDrawingOptions(image_id, update) => {
                let current_drawing_options = state.drawing_options.borrow().get_or_default(&image_id).clone();
                let new_drawing_option = match update {
                    UpdateDrawingOptions::Reset => DrawingOptions::default(),
                    UpdateDrawingOptions::Coloring(c) => DrawingOptions { coloring: c, ..current_drawing_options},
                    UpdateDrawingOptions::Invert(i) => DrawingOptions { invert: i, ..current_drawing_options},
                    UpdateDrawingOptions::HighContrast(hc) => DrawingOptions { high_contrast: hc, ..current_drawing_options},
                    UpdateDrawingOptions::IgnoreAlpha(ia) => DrawingOptions { ignore_alpha: ia, ..current_drawing_options},
                };
                state.drawing_options.borrow_mut().set(image_id, new_drawing_option);
            }
         };

        app_state
    }
}

#[derive(Debug)]
pub(crate) enum RequestAction {
    ImageDataById(ImageId),
    ImagesList,
}

#[async_reducer]
impl AsyncReducer<AppState> for RequestAction {
    async fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        log::debug!("Reducer: RequestAction");

        let state = Rc::make_mut(&mut app_state);

        match self {
            RequestAction::ImageDataById(image_id) => {}

            RequestAction::ImagesList => {
                // if let Some(message_service) = state.message_service {
                //     message_service.send_message(RequestImagesMessage{}.into());
                // }
            }
        };

        app_state
    }
}
