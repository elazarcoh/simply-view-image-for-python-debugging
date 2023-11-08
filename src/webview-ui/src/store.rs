use std::{collections::HashMap, fmt::Debug, rc::Rc};

use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

use crate::{
    configurations,
    image_view::{
        camera::ViewsCameras,
        image_cache::ImageCache,
        image_views::ImageViews,
        types::{DrawingOptions, ImageId, ViewId},
    },
    vscode::vscode_requests::VSCodeRequests,
};

#[derive(Default)]
pub struct Images {
    pub image_ids: Vec<ImageId>,
    pub by_id: HashMap<ImageId, crate::communication::incoming_messages::ImageInfo>,
}

#[derive(Default)]
pub struct ImagesDrawingOptions {
    by_id: HashMap<ImageId, DrawingOptions>,
}

impl ImagesDrawingOptions {
    pub fn set(&mut self, image_id: ImageId, drawing_options: DrawingOptions) {
        self.by_id.insert(image_id, drawing_options);
    }

    pub fn get_or_default(&self, image_id: &ImageId) -> DrawingOptions {
        self.by_id
            .get(image_id)
            .cloned()
            .unwrap_or(DrawingOptions::default())
    }
}

struct ImagesFetcher;

impl Listener for ImagesFetcher {
    type Store = AppState;

    fn on_change(&mut self, state: Rc<Self::Store>) {
        let currently_viewing_image_ids = state
            .image_views
            .borrow()
            .visible_views()
            .iter()
            .filter_map(|view_id| state.image_views.borrow().get_image_id(*view_id))
            .collect::<Vec<_>>();

        for image_id in currently_viewing_image_ids {
            log::debug!(
                "ImagesFetcher::on_change: currently viewing image {}",
                image_id
            );
            if !state.image_cache.borrow().has(&image_id) {
                log::debug!("ImagesFetcher::on_change: image {} not in cache", image_id);
                if let Some(image_info) = state.images.borrow().by_id.get(&image_id) {
                    log::debug!("ImagesFetcher::on_change: fetching image {}", image_id);
                    VSCodeRequests::request_image_data(image_id, image_info.expression.clone());
                }
            }
        }
    }
}

#[derive(Store, Clone)]
#[store(listener(ImagesFetcher))]
pub struct AppState {
    pub gl: Option<WebGl2RenderingContext>,

    pub images: Mrc<Images>,
    image_views: Mrc<ImageViews>,
    pub image_cache: Mrc<ImageCache>,
    pub drawing_options: Mrc<ImagesDrawingOptions>,

    pub view_cameras: Mrc<ViewsCameras>,

    // pub message_service: Option<Rc<dyn OutgoingMessageSender>>,
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
            // message_service: Default::default(),
            configuration: Default::default(),
            drawing_options: Default::default(),
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
    }
}
