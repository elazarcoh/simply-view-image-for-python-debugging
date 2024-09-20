use super::colormaps::{ColorMapRegistry, ColorMapTexturesCache};
use super::images::{ImageAvailability, ImageCache, Images, ImagesDrawingOptions};
use super::views::ImageViews;
use crate::coloring::{Coloring, DrawingOptions};
use crate::common::camera::ViewsCameras;
use crate::common::texture_image::TextureImage;
use crate::common::{
    CurrentlyViewing, Image, ImageData, ImageInfo, ImagePlaceholder, MinimalImageInfo, ViewId,
    ViewableObjectId,
};
use crate::{configurations, vscode::vscode_requests::VSCodeRequests};
use anyhow::{anyhow, Result};
use itertools::Itertools;
use std::rc::Rc;
use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

struct ImagesFetcher;

impl Listener for ImagesFetcher {
    type Store = AppState;

    fn on_change(&mut self, _cx: &yewdux::Context, state: Rc<Self::Store>) {
        let currently_viewing_objects = state
            .image_views
            .borrow()
            .visible_views()
            .iter()
            .filter_map(|view_id| state.image_views.borrow().get_currently_viewing(*view_id))
            .collect::<Vec<_>>();

        for cv in currently_viewing_objects {
            match cv {
                crate::common::CurrentlyViewing::Image(image_id) => {
                    let current = state.image_cache.borrow().get(&image_id);

                    if current == ImageAvailability::NotAvailable {
                        log::debug!("ImagesFetcher::on_change: image {} not in cache", image_id);
                        if let Some(image_info) = state.images.borrow().get(&image_id) {
                            log::debug!("ImagesFetcher::on_change: fetching image {}", image_id);
                            VSCodeRequests::request_image_data(
                                image_id.clone(),
                                image_info.minimal().expression.clone(),
                            );
                            state.image_cache.borrow_mut().set_pending(&image_id);
                        }
                    }
                }
                crate::common::CurrentlyViewing::BatchItem(image_id) => {
                    let current = state.image_cache.borrow().get(&image_id);

                    if let ImageAvailability::NotAvailable = current {
                        log::debug!("ImagesFetcher::on_change: image {} not in cache", image_id);
                        if let Some(image_info) = state.images.borrow().get(&image_id) {
                            let expression = image_info.minimal().expression.clone();
                            let current_index = state
                                .drawing_options
                                .borrow()
                                .get_or_default(&image_id)
                                .as_batch_slice
                                .1;
                            log::debug!(
                                "ImagesFetcher::on_change: fetching item {} for image {}",
                                current_index,
                                image_id
                            );
                            VSCodeRequests::request_batch_item_data(
                                image_id.clone(),
                                expression,
                                current_index,
                                None,
                            );
                            state.image_cache.borrow_mut().set_pending(&image_id);
                        }
                    } else if let ImageAvailability::Pending(Some(image))
                    | ImageAvailability::Available(image) = current
                    {
                        // generally available, but maybe batch item is not.
                        let current_drawing_options = state
                            .drawing_options
                            .borrow()
                            .get_or_default(&image_id)
                            .clone();

                        let (is_batched, current_index) = current_drawing_options.as_batch_slice;
                        if is_batched {
                            let has_item = image.borrow().textures.contains_key(&current_index);
                            if has_item {
                                // changed back to batch item that is already in cache
                                let _ = state
                                    .image_cache
                                    .borrow_mut()
                                    .try_set_available(&image_id)
                                    .map_err(|e| log::error!("ImagesFetcher::on_change: {}", e));
                            } else {
                                let expression = state
                                    .images
                                    .borrow()
                                    .get(&image_id)
                                    .unwrap()
                                    .minimal()
                                    .expression
                                    .clone();
                                let currently_holding =
                                    image.borrow().textures.keys().copied().collect_vec();
                                log::debug!(
                                    "ImagesFetcher::on_change: fetching item {} for image {}",
                                    current_index,
                                    image_id
                                );
                                VSCodeRequests::request_batch_item_data(
                                    image_id.clone(),
                                    expression,
                                    current_index,
                                    Some(currently_holding),
                                );
                                state.image_cache.borrow_mut().set_pending(&image_id);
                            }
                        }
                    } else {
                        log::debug!("ImagesFetcher::on_change: current {:?} ", current);
                    }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq)]
pub(crate) struct GlobalDrawingOptions {
    pub heatmap_colormap_name: String,
    pub segmentation_colormap_name: String,
}

impl Default for GlobalDrawingOptions {
    fn default() -> Self {
        Self {
            heatmap_colormap_name: "fire".to_string(),
            segmentation_colormap_name: "glasbey".to_string(),
        }
    }
}

#[derive(Store, Clone)]
#[store(listener(ImagesFetcher))]
pub(crate) struct AppState {
    pub gl: Option<WebGl2RenderingContext>,

    pub images: Mrc<Images>,
    pub image_views: Mrc<ImageViews>,
    pub image_cache: Mrc<ImageCache>,
    pub drawing_options: Mrc<ImagesDrawingOptions>,
    pub global_drawing_options: GlobalDrawingOptions,

    pub color_map_registry: Mrc<ColorMapRegistry>,
    pub color_map_textures_cache: Mrc<ColorMapTexturesCache>,

    pub view_cameras: Mrc<ViewsCameras>,

    pub configuration: configurations::Configuration,
}

impl AppState {
    pub(crate) fn gl(&self) -> Result<&WebGl2RenderingContext> {
        self.gl
            .as_ref()
            .ok_or(anyhow!("WebGL context not initialized"))
    }

    pub(crate) fn set_image_to_view(&mut self, image_id: ViewableObjectId, view_id: ViewId) {
        let is_batched = self
            .images
            .borrow()
            .get(&image_id)
            .map_or(false, |info| info.minimal().is_batched);

        if is_batched {
            self.image_views
                .borrow_mut()
                .set_batch_item_to_view(image_id, view_id);
        } else {
            self.image_views
                .borrow_mut()
                .set_image_to_view(image_id, view_id);
        }

        // send event to view
        self.image_views
            .borrow()
            .send_event_to_view(view_id, "svifpd:changeimage");
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            gl: None,
            images: Default::default(),
            image_views: Default::default(),
            image_cache: Default::default(),
            view_cameras: Default::default(),
            color_map_registry: Default::default(),
            color_map_textures_cache: Default::default(),
            configuration: Default::default(),
            drawing_options: Default::default(),
            global_drawing_options: Default::default(),
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
            && self.gl == other.gl
            && self.drawing_options == other.drawing_options
            && self.global_drawing_options == other.global_drawing_options
    }
}

pub(crate) enum UpdateDrawingOptions {
    Reset,
    Coloring(Coloring),
    Invert(bool),
    HighContrast(bool),
    IgnoreAlpha(bool),
}

#[allow(dead_code)]
pub(crate) enum UpdateGlobalDrawingOptions {
    GlobalHeatmapColormap(String),
    GlobalSegmentationColormap(String),
}

pub(crate) enum ImageObject {
    Placeholder(ImagePlaceholder),
    InfoOnly(ImageInfo),
    WithData(ImageData),
}

impl ImageObject {
    fn image_id(&self) -> &ViewableObjectId {
        match self {
            ImageObject::InfoOnly(info) => &info.image_id,
            ImageObject::WithData(data) => &data.info.image_id,
            ImageObject::Placeholder(image_placeholder) => &image_placeholder.image_id,
        }
    }
    fn image_minimal_info(&self) -> MinimalImageInfo {
        match self {
            ImageObject::InfoOnly(info) => MinimalImageInfo {
                image_id: &info.image_id,
                value_variable_kind: &info.value_variable_kind,
                expression: &info.expression,
                additional_info: &info.additional_info,
                is_batched: false,
            },
            ImageObject::WithData(data) => MinimalImageInfo {
                image_id: &data.info.image_id,
                value_variable_kind: &data.info.value_variable_kind,
                expression: &data.info.expression,
                additional_info: &data.info.additional_info,
                is_batched: false,
            },
            ImageObject::Placeholder(image_placeholder) => MinimalImageInfo {
                image_id: &image_placeholder.image_id,
                value_variable_kind: &image_placeholder.value_variable_kind,
                expression: &image_placeholder.expression,
                additional_info: &image_placeholder.additional_info,
                is_batched: false,
            },
        }
    }
    // fn image_info(&self) -> &ImageInfo {
    //     match self {
    //         ImageObject::InfoOnly(info) => info,
    //         ImageObject::WithData(data) => &data.info,
    //         ImageObject::Placeholder(image_placeholder) => todo!(),
    //     }
    // }
}

pub(crate) enum StoreAction {
    SetImageToView(ViewableObjectId, ViewId),
    SetAsBatched(ViewableObjectId, bool),
    AddTextureImage(ViewableObjectId, Box<TextureImage>),
    AddImageWithData(ViewableObjectId, ImageData),
    UpdateDrawingOptions(ViewableObjectId, UpdateDrawingOptions),
    UpdateGlobalDrawingOptions(UpdateGlobalDrawingOptions),
    ReplaceData(Vec<ImageObject>),
    UpdateData(ImageObject),
}

fn handle_received_image(state: &AppState, image: ImageObject) -> Result<()> {
    let image_id = image.image_id().clone();

    if let ImageObject::Placeholder(image_placeholder) = &image {
        state.images.borrow_mut().insert(
            image_id.clone(),
            Image::Placeholder(image_placeholder.clone()),
        );
        return Ok(());
    }

    let image_info = match image {
        ImageObject::InfoOnly(ref info) => info.clone(),
        ImageObject::WithData(ref data) => data.info.clone(),
        _ => unreachable!(),
    };
    let batch_info = image_info.batch_info.clone();
    let is_batched = batch_info.is_some();

    state
        .images
        .borrow_mut()
        .insert(image_id.clone(), Image::Full(image_info));

    if let ImageObject::WithData(image_data) = image {
        let tex_image = TextureImage::try_new(image_data, state.gl.as_ref().unwrap())?;
        log::debug!(
            "updaing image cache: {:?} is_batched: {}, tex_image: {:?}",
            image_id,
            is_batched,
            tex_image
        );
        if is_batched {
            state.image_cache.borrow_mut().update(&image_id, tex_image);
        } else {
            state
                .image_cache
                .borrow_mut()
                .set_image(&image_id, tex_image);
        }
    }

    if is_batched {
        let current_drawing_options = state
            .drawing_options
            .borrow()
            .get_or_default(&image_id)
            .clone();
        state.drawing_options.borrow_mut().set(
            image_id.clone(),
            DrawingOptions {
                as_batch_slice: (true, current_drawing_options.as_batch_slice.1),
                ..current_drawing_options
            },
        );
    }

    Ok(())
}

impl Reducer<AppState> for StoreAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        let state = Rc::make_mut(&mut app_state);

        match self {
            StoreAction::SetImageToView(image_id, view_id) => {
                state.set_image_to_view(image_id, view_id);
            }

            StoreAction::AddTextureImage(image_id, texture_image) => {
                log::debug!("AddTextureImage: {:?}", image_id);
                let info = texture_image.info.clone();
                state
                    .image_cache
                    .borrow_mut()
                    .set_image(&image_id, *texture_image);
                state
                    .images
                    .borrow_mut()
                    .insert(image_id, Image::Full(info));
            }

            StoreAction::AddImageWithData(image_id, image_data) => {
                log::debug!("AddImageWithData: {:?}", image_id);
                let image_object = ImageObject::WithData(image_data);
                handle_received_image(state, image_object)
                    .map_err(|e| {
                        log::error!("Error handling image data: {:?}", e);
                    })
                    .ok();
            }

            StoreAction::UpdateDrawingOptions(image_id, update) => {
                let current_drawing_options = state
                    .drawing_options
                    .borrow()
                    .get_or_default(&image_id)
                    .clone();
                let new_drawing_option = match update {
                    UpdateDrawingOptions::Reset => DrawingOptions {
                        // keep the batch slice index
                        as_batch_slice: current_drawing_options.as_batch_slice,
                        ..DrawingOptions::default()
                    },
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
                    let res = handle_received_image(state, image);
                    if let Err(e) = res {
                        errors.push(e);
                    }
                }
            }

            StoreAction::UpdateGlobalDrawingOptions(opts) => match opts {
                UpdateGlobalDrawingOptions::GlobalHeatmapColormap(name) => {
                    state.global_drawing_options.heatmap_colormap_name = name;
                }
                UpdateGlobalDrawingOptions::GlobalSegmentationColormap(name) => {
                    state.global_drawing_options.segmentation_colormap_name = name;
                }
            },
            StoreAction::SetAsBatched(image_id, as_batched) => {
                let current_drawing_options = state
                    .drawing_options
                    .borrow()
                    .get_or_default(&image_id)
                    .clone();
                state.drawing_options.borrow_mut().set(image_id, {
                    DrawingOptions {
                        as_batch_slice: (as_batched, current_drawing_options.as_batch_slice.1),
                        ..current_drawing_options
                    }
                });
            }
            StoreAction::UpdateData(image_object) => {
                handle_received_image(state, image_object).unwrap();
            }
        };

        app_state
    }
}

pub(crate) enum ChangeImageAction {
    Next(ViewId),
    Previous(ViewId),
    Pin(ViewableObjectId),
    Unpin(ViewableObjectId),
    ViewShiftScroll(ViewId, CurrentlyViewing, f64),
}

impl Reducer<AppState> for ChangeImageAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        let state = Rc::make_mut(&mut app_state);

        match self {
            ChangeImageAction::Next(view_id) => {
                let next_image_id = state
                    .image_views
                    .borrow()
                    .get_currently_viewing(view_id)
                    .and_then(|current_image_id| {
                        state
                            .images
                            .borrow()
                            .next_image_id(&current_image_id.into())
                            .cloned()
                    })
                    .or_else(|| {
                        // If no image is currently displayed, show the first image
                        state
                            .images
                            .borrow()
                            .iter()
                            .next()
                            .map(|(image_id, _)| image_id.clone())
                    });
                next_image_id.map(|next_image_id| {
                    state.set_image_to_view(next_image_id, view_id);
                });
            }
            ChangeImageAction::Previous(view_id) => {
                let previous_image_id = state
                    .image_views
                    .borrow()
                    .get_currently_viewing(view_id)
                    .and_then(|current_image_id| {
                        state
                            .images
                            .borrow()
                            .previous_image_id(&current_image_id.into())
                            .cloned()
                    })
                    .or_else(|| {
                        // If no image is currently displayed, show the last image
                        state
                            .images
                            .borrow()
                            .iter()
                            .next_back()
                            .map(|(image_id, _)| image_id.clone())
                    });
                previous_image_id.map(|previous_image_id| {
                    state.set_image_to_view(previous_image_id, view_id);
                });
            }
            ChangeImageAction::Pin(image_id) => {
                state.images.borrow_mut().pin(&image_id);
            }
            ChangeImageAction::Unpin(image_id) => {
                state.images.borrow_mut().unpin(&image_id);
            }
            ChangeImageAction::ViewShiftScroll(view_id, cv, amount) => {
                let id = cv.into();
                let current_drawing_options = state.drawing_options.borrow().get_or_default(&id);
                if let Image::Full(info) = state.images.borrow().get(&id).unwrap() {
                    if current_drawing_options.as_batch_slice.0 {
                        let batch_size = info.batch_info.as_ref().map_or(1, |info| info.batch_size);

                        let current_index = current_drawing_options.as_batch_slice.1;
                        let new_index = ((current_index as f64 + amount) as i32)
                            .clamp(0, batch_size as i32 - 1)
                            as u32;
                        if new_index != current_index {
                            state.drawing_options.borrow_mut().set(
                                id,
                                DrawingOptions {
                                    as_batch_slice: (
                                        current_drawing_options.as_batch_slice.0,
                                        new_index,
                                    ),
                                    ..current_drawing_options
                                },
                            );

                            // send event to view that the batch item has changed
                            state
                                .image_views
                                .borrow()
                                .send_event_to_view(view_id, "svifpd:changeimage");
                        }
                    }
                }
            }
        }

        app_state
    }
}
