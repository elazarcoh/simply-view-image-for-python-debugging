use std::{collections::HashMap, rc::Rc};

use yewdux::prelude::*;

use crate::{
    common::{ImageData, ImageInfo},
    image_view::{
        image_cache,
        types::{Coloring, DrawingOptions, ImageId, TextureImage, ViewId},
    },
    store::AppState,
};

pub(crate) enum UpdateDrawingOptions {
    Reset,
    Coloring(Coloring),
    Invert(bool),
    HighContrast(bool),
    IgnoreAlpha(bool),
}

pub(crate) enum ImageObject {
    InfoOnly(ImageInfo),
    WithData(ImageData),
}
impl ImageObject {
    fn image_id(&self) -> &ImageId {
        match self {
            ImageObject::InfoOnly(info) => &info.image_id,
            ImageObject::WithData(data) => &data.info.image_id,
        }
    }
    fn image_info(&self) -> &ImageInfo {
        match self {
            ImageObject::InfoOnly(info) => info,
            ImageObject::WithData(data) => &data.info,
        }
    }
}

pub(crate) enum StoreAction {
    SetImageToView(ImageId, ViewId),
    AddTextureImage(ImageId, Box<TextureImage>),
    UpdateDrawingOptions(ImageId, UpdateDrawingOptions),
    ReplaceData(Vec<ImageObject>),
}

impl Reducer<AppState> for StoreAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        log::debug!("Reducer for StoreAction called");
        let state = Rc::make_mut(&mut app_state);

        match self {
            StoreAction::SetImageToView(image_id, view_id) => {
                log::debug!("SetImageToView: {:?} {:?}", image_id, view_id);
                state.set_image_to_view(image_id, view_id);
            }

            StoreAction::AddTextureImage(image_id, texture_image) => {
                log::debug!("AddTextureImage: {:?}", image_id);
                state
                    .image_cache
                    .borrow_mut()
                    .set(&image_id, *texture_image);
            }

            StoreAction::UpdateDrawingOptions(image_id, update) => {
                let current_drawing_options = state
                    .drawing_options
                    .borrow()
                    .get_or_default(&image_id)
                    .clone();
                let new_drawing_option = match update {
                    UpdateDrawingOptions::Reset => DrawingOptions::default(),
                    UpdateDrawingOptions::Coloring(c) => DrawingOptions {
                        coloring: c,
                        ..current_drawing_options
                    },
                    UpdateDrawingOptions::Invert(i) => DrawingOptions {
                        invert: i,
                        ..current_drawing_options
                    },
                    UpdateDrawingOptions::HighContrast(hc) => DrawingOptions {
                        high_contrast: hc,
                        ..current_drawing_options
                    },
                    UpdateDrawingOptions::IgnoreAlpha(ia) => DrawingOptions {
                        ignore_alpha: ia,
                        ..current_drawing_options
                    },
                };
                state
                    .drawing_options
                    .borrow_mut()
                    .set(image_id, new_drawing_option);
            }

            StoreAction::ReplaceData(replacement_images) => {
                log::debug!("ReplaceData");
                state.image_cache.borrow_mut().clear();
                state.images.borrow_mut().clear();

                let mut errors = Vec::new();
                for image in replacement_images.into_iter() {
                    let image_id = image.image_id().clone();
                    let image_info = image.image_info().clone();

                    state
                        .images
                        .borrow_mut()
                        .insert(image_id.clone(), image_info);

                    if let ImageObject::WithData(image_data) = image {
                        let tex_image =
                            TextureImage::try_new(image_data, state.gl.as_ref().unwrap());
                        match tex_image {
                            Ok(tex_image) => {
                                state.image_cache.borrow_mut().set(&image_id, tex_image);
                            }
                            Err(e) => {
                                errors.push(e);
                            }
                        }
                    }
                }
                // let images = replacement_images
                //     .objects
                //     .iter()
                //     .map(|info| (info.image_id.clone(), info.clone()))
                //     .collect();
                // state.images.borrow_mut().update(images);

                // let res = replacement_images
                //     .objects
                //     .iter()
                //     .map(|info| info.image_id.clone())
                //     .map(|image_id| -> Result<(), String> {
                //         if let Some(image_data) = replacement_data.remove(&image_id) {
                //             let tex_image =
                //                 TextureImage::try_new(image_data, state.gl.as_ref().unwrap())?;

                //             state.image_cache.borrow_mut().set(&image_id, tex_image);
                //         };
                //         Ok(())
                //     })
                //     .collect::<Result<Vec<_>, _>>();
                // if let Err(e) = res {
                //     log::error!("Error while updating image cache: {:?}", e);
                // }
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
