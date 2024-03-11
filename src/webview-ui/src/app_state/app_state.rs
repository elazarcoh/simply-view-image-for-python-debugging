use super::colormaps::{ColorMapRegistry, ColorMapTexturesCache};
use super::images::{Images, ImagesDrawingOptions};
use super::viewables_cache::ViewablesCache;
use super::views::ImageViews;
use crate::common::camera::ViewsCameras;
use crate::common::texture_image::TextureImage;
use crate::common::{ImageAvailability, ImageData, ImageId, ImageInfo, ViewId, Viewable};
use crate::rendering::coloring::{Coloring, DrawingOptions};
use crate::{configurations, vscode::vscode_requests::VSCodeRequests};
use anyhow::{anyhow, Result};
use std::rc::Rc;
use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

struct ImagesFetcher;

impl Listener for ImagesFetcher {
    type Store = AppState;

    fn on_change(&mut self, _cx: &yewdux::Context, state: Rc<Self::Store>) {
        let currently_viewing_image_ids = state
            .image_views
            .borrow()
            .visible_views()
            .iter()
            .filter_map(|view_id| state.image_views.borrow().get_viewable(*view_id))
            .collect::<Vec<_>>();

        for viewable in currently_viewing_image_ids {
            match viewable {
                Viewable::Image(image_id) => {
                    if !state.viewables_cache.borrow().has(&image_id) {
                        log::debug!("ImagesFetcher::on_change: image {} not in cache", image_id);
                        if let Some(image_info) = state.images.borrow().get(&image_id) {
                            log::debug!("ImagesFetcher::on_change: fetching image {}", image_id);
                            VSCodeRequests::request_image_data(
                                image_id.clone(),
                                image_info.expression.clone(),
                            );
                            state.viewables_cache.borrow_mut().set_pending(&image_id);
                        }
                    }
                }
                Viewable::Plotly(_) => {}
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
    pub viewables_cache: Mrc<ViewablesCache>,
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

    pub(crate) fn get_object_from_cache(&self, viewable: Viewable) -> ImageAvailability {
        match viewable {
            Viewable::Image(image_id) => self.viewables_cache.borrow().get(&image_id),
            Viewable::Plotly(_) => ImageAvailability::PlotlyAvailable(()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            gl: None,
            images: Default::default(),
            image_views: Default::default(),
            viewables_cache: Default::default(),
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
            && self.viewables_cache == other.viewables_cache
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
    SetObjectToView(Viewable, ViewId),
    AddTextureImage(ImageId, Box<TextureImage>),
    UpdateDrawingOptions(ImageId, UpdateDrawingOptions),
    UpdateGlobalDrawingOptions(UpdateGlobalDrawingOptions),
    ReplaceData(Vec<ImageObject>),
}

impl Reducer<AppState> for StoreAction {
    fn apply(self, mut app_state: Rc<AppState>) -> Rc<AppState> {
        let state = Rc::make_mut(&mut app_state);

        match self {
            StoreAction::SetObjectToView(viewable, view_id) => {
                state
                    .image_views
                    .borrow_mut()
                    .set_object_to_view(viewable, view_id);
            }

            StoreAction::AddTextureImage(image_id, texture_image) => {
                log::debug!("AddTextureImage: {:?}", image_id);
                let info = texture_image.image.info.clone();
                state
                    .viewables_cache
                    .borrow_mut()
                    .set(&image_id, *texture_image);
                state.images.borrow_mut().insert(image_id, info);
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
                state.viewables_cache.borrow_mut().clear();
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
                                state.viewables_cache.borrow_mut().set(&image_id, tex_image);
                            }
                            Err(e) => {
                                errors.push(e);
                            }
                        }
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
        };

        app_state
    }
}
