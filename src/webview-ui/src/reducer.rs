use std::{borrow::BorrowMut, collections::HashMap, rc::Rc};

use web_sys::WebGl2RenderingContext;
use yewdux::prelude::*;

use crate::{
    communication::incoming_messages::ImageInfo,
    image_view::types::{ImageId, TextureImage, ViewId},
    store::AppState,
};

pub enum StoreAction {
    UpdateImages(Vec<(ImageId, ImageInfo)>),
    SetImageToView(ImageId, ViewId),
    AddTextureImage(ImageId, TextureImage),
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
                state.image_cache.borrow_mut().set(&image_id, texture_image);
            }
        };

        app_state
    }
}

#[derive(Debug)]
pub enum RequestAction {
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
