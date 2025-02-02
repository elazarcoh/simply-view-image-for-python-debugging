use super::colormaps::{ColorMapRegistry, ColorMapTexturesCache};
use super::images::{ImageCache, Images, ImagesDrawingOptions};
use super::views::ImageViews;
use super::vscode_data_fetcher::ImagesFetcher;
use crate::coloring::{Clip, Coloring, DrawingOptions};
use crate::common::camera::ViewsCameras;
use crate::common::texture_image::TextureImage;
use crate::common::{
    CurrentlyViewing, Image, ImageData, ImagePlaceholder, ViewId, ViewableObjectId,
};
use crate::configurations;
use anyhow::{anyhow, Result};
use yew::NodeRef;
use std::collections::HashMap;
use std::rc::Rc;
use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

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

#[derive(Clone, PartialEq, Hash, Eq)]
pub(crate) enum ElementsStoreKey {
    ColorBar,
}

#[derive(Default, Clone)]
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

    pub elements_refs_store: Mrc<HashMap<ElementsStoreKey, NodeRef>>,

    pub configuration: configurations::Configuration,
}

impl Store for AppState {
    fn new(cx: &yewdux::Context) -> Self {
        init_listener(ImagesFetcher::default(), cx);
        Default::default()
    }

    fn should_notify(&self, other: &Self) -> bool {
        self != other
    }
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
    ClipMin(Option<f32>),
    ClipMax(Option<f32>),
}

#[allow(dead_code)]
pub(crate) enum UpdateGlobalDrawingOptions {
    GlobalHeatmapColormap(String),
    GlobalSegmentationColormap(String),
}

pub(crate) enum ImageObject {
    Placeholder(ImagePlaceholder),
    WithData(ImageData),
}

impl ImageObject {
    fn image_id(&self) -> &ViewableObjectId {
        match self {
            ImageObject::WithData(data) => &data.info.image_id,
            ImageObject::Placeholder(image_placeholder) => &image_placeholder.image_id,
        }
    }
}

pub(crate) enum StoreAction {
    SetImageToView(ViewableObjectId, ViewId),
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
            "updating image cache: {:?} is_batched: {}, tex_image: {:?}",
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
        state
            .drawing_options
            .borrow_mut()
            .mut_ref_or_default(image_id.clone())
            .batch_item
            .get_or_insert(0);
    }

    // if the image is currently displayed, update the view
    let views_for_image = state.image_views.borrow().is_currently_viewing(&image_id);
    views_for_image.iter().for_each(|view_id| {
        if is_batched {
            state
                .image_views
                .borrow_mut()
                .set_batch_item_to_view(image_id.clone(), *view_id);
        } else {
            state
                .image_views
                .borrow_mut()
                .set_image_to_view(image_id.clone(), *view_id);
        }
    });

    Ok(())
}

impl Reducer<AppState> for StoreAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        let state = Rc::make_mut(&mut app_state);

        match self {
            StoreAction::SetImageToView(image_id, view_id) => {
                state.set_image_to_view(image_id, view_id);
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
                        batch_item: current_drawing_options.batch_item,
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
                    UpdateDrawingOptions::ClipMin(min) => DrawingOptions {
                        clip: Clip {
                            min,
                            ..current_drawing_options.clip
                        },
                        ..current_drawing_options
                    },
                    UpdateDrawingOptions::ClipMax(max) => DrawingOptions {
                        clip: Clip {
                            max,
                            ..current_drawing_options.clip
                        },
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
            StoreAction::UpdateData(image_object) => {
                handle_received_image(state, image_object).unwrap();
            }
        };

        app_state
    }
}

pub(crate) enum UiAction {
    Next(ViewId),
    Previous(ViewId),
    Pin(ViewableObjectId),
    Unpin(ViewableObjectId),
    ViewShiftScroll(ViewId, CurrentlyViewing, f64),
    Home(ViewId),
}

impl Reducer<AppState> for UiAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        let state = Rc::make_mut(&mut app_state);

        match self {
            UiAction::Next(view_id) => {
                let next_image_id = state
                    .image_views
                    .borrow()
                    .get_currently_viewing(view_id)
                    .and_then(|current_image_id| {
                        state
                            .images
                            .borrow()
                            .next_image_id(current_image_id.id())
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
                if let Some(next_image_id) = next_image_id {
                    state.set_image_to_view(next_image_id, view_id);
                }
            }
            UiAction::Previous(view_id) => {
                let previous_image_id = state
                    .image_views
                    .borrow()
                    .get_currently_viewing(view_id)
                    .and_then(|current_image_id| {
                        state
                            .images
                            .borrow()
                            .previous_image_id(current_image_id.id())
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
                if let Some(previous_image_id) = previous_image_id {
                    state.set_image_to_view(previous_image_id, view_id);
                }
            }
            UiAction::Pin(image_id) => {
                state.images.borrow_mut().pin(&image_id);
            }
            UiAction::Unpin(image_id) => {
                state.images.borrow_mut().unpin(&image_id);
            }
            UiAction::ViewShiftScroll(view_id, cv, amount) => {
                let id = cv.id();

                let current_drawing_options = state.drawing_options.borrow().get_or_default(id);
                if let (Some(current_index), Some(Image::Full(info))) = (
                    current_drawing_options.batch_item,
                    state.images.borrow().get(id),
                ) {
                    let batch_size = info.batch_info.as_ref().map_or(1, |info| info.batch_size);

                    let new_index = ((current_index as f64 + amount) as i32)
                        .clamp(0, batch_size as i32 - 1) as u32;

                    if new_index != current_index {
                        state
                            .drawing_options
                            .borrow_mut()
                            .mut_ref_or_default(id.clone())
                            .batch_item = Some(new_index);

                        // send event to view that the batch item has changed
                        state
                            .image_views
                            .borrow()
                            .send_event_to_view(view_id, "svifpd:changeimage");
                    }
                }
            }
            UiAction::Home(view_id) => {
                state.view_cameras.borrow_mut().reset(view_id);
            }
        }

        app_state
    }
}
