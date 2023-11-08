use std::{collections::HashMap, rc::Rc};

use yewdux::prelude::*;

use crate::{
    image_view::types::ImageId,
    store::{AppState, ImageData},
};

pub enum StoreAction {
    UpdateImages(Vec<(ImageId, ImageData)>),
}

impl Reducer<AppState> for StoreAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        let state = Rc::make_mut(&mut app_state);

        match self {
            StoreAction::UpdateImages(images) => {
                let images_hashmap = images.into_iter().collect::<HashMap<_, _>>();
                let ids = images_hashmap.keys().cloned().collect::<Vec<_>>();
                {
                    let mut mutable = state.images.borrow_mut();
                    mutable.image_ids = ids;
                    mutable.by_id = images_hashmap;
                }
            }
        };

        app_state
    }
}
