use anyhow::{anyhow, Result};
use std::{collections::HashMap, rc::Rc};

use web_sys::WebGl2RenderingContext;
use yewdux::{mrc::Mrc, prelude::*};

use crate::{
    app_state::datasetructures::image_cache::ImageCache,
    common::{ImageId, ImageInfo},
    configurations,
    image_view::{
        builtin_colormaps::BUILTIN_COLORMAPS, camera::ViewsCameras, colormap,
        image_views::ImageViews, types::ViewId,
    },
    rendering::coloring::DrawingOptions,
    vscode::vscode_requests::VSCodeRequests,
    webgl_utils::GLGuard,
};

#[derive(Default)]
pub(crate) struct Images(HashMap<ImageId, ImageInfo>);

impl Images {
    pub fn get(&self, image_id: &ImageId) -> Option<&ImageInfo> {
        self.0.get(image_id)
    }

    pub fn insert(&mut self, image_id: ImageId, image_info: ImageInfo) {
        self.0.insert(image_id, image_info);
    }

    pub fn clear(&mut self) {
        self.0.clear();
    }

    pub fn update(&mut self, images: Vec<(ImageId, ImageInfo)>) {
        images.iter().for_each(|(id, info)| {
            self.0.insert(id.clone(), info.clone());
        });
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&ImageId, &ImageInfo)> {
        self.0.iter()
    }
}

#[derive(Default)]
pub(crate) struct ImagesDrawingOptions {
    by_id: HashMap<ImageId, DrawingOptions>,
}

impl ImagesDrawingOptions {
    pub(crate) fn set(&mut self, image_id: ImageId, drawing_options: DrawingOptions) {
        self.by_id.insert(image_id, drawing_options);
    }

    pub(crate) fn get_or_default(&self, image_id: &ImageId) -> DrawingOptions {
        self.by_id
            .get(image_id)
            .cloned()
            .unwrap_or(DrawingOptions::default())
    }
}

struct ColorMapTexturesCache(HashMap<String, Rc<GLGuard<web_sys::WebGlTexture>>>);

impl ColorMapTexturesCache {
    pub(crate) fn new() -> Self {
        Self(HashMap::new())
    }

    pub(crate) fn get_or_create(
        &mut self,
        gl: &WebGl2RenderingContext,
        colormap: &colormap::ColorMap,
    ) -> Result<Rc<GLGuard<web_sys::WebGlTexture>>> {
        let name = colormap.name.to_string();
        if self.0.contains_key(&name) {
            return Ok(self.0.get(&name).unwrap().clone());
        }

        let tex = colormap::create_texture_for_colormap(gl, colormap)?;
        self.0.insert(name.clone(), Rc::new(tex));
        Ok(self.0.get(&name).unwrap().clone())
    }
}

impl Default for ColorMapTexturesCache {
    fn default() -> Self {
        Self::new()
    }
}

struct ColorMapRegistry(HashMap<String, Rc<colormap::ColorMap>>);
impl ColorMapRegistry {
    pub(crate) fn new() -> Self {
        Self(HashMap::new())
    }

    pub(crate) fn get(&self, name: &str) -> Option<Rc<colormap::ColorMap>> {
        self.0.get(name).cloned()
    }

    pub(crate) fn register(&mut self, colormap: colormap::ColorMap) {
        self.0.insert(colormap.name.to_string(), Rc::new(colormap));
    }
}
impl Default for ColorMapRegistry {
    fn default() -> Self {
        let mut registry = Self::new();
        BUILTIN_COLORMAPS
            .iter()
            .for_each(|c| registry.register(c.clone()));
        registry
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
                if let Some(image_info) = state.images.borrow().get(&image_id) {
                    log::debug!("ImagesFetcher::on_change: fetching image {}", image_id);
                    VSCodeRequests::request_image_data(image_id, image_info.expression.clone());
                }
            }
        }
    }
}

#[derive(Store, Clone)]
#[store(listener(ImagesFetcher))]
pub(crate) struct AppState {
    pub gl: Option<WebGl2RenderingContext>,

    pub images: Mrc<Images>,
    image_views: Mrc<ImageViews>,
    pub image_cache: Mrc<ImageCache>,
    pub drawing_options: Mrc<ImagesDrawingOptions>,

    color_map_registry: Mrc<ColorMapRegistry>,
    color_map_textures_cache: Mrc<ColorMapTexturesCache>,

    pub view_cameras: Mrc<ViewsCameras>,

    // pub message_service: Option<Rc<dyn OutgoingMessageSender>>,
    pub configuration: configurations::Configuration,
}

impl AppState {
    pub(crate) fn image_views(&self) -> Mrc<ImageViews> {
        self.image_views.clone()
    }

    pub(crate) fn set_image_to_view(&mut self, image_id: ImageId, view_id: ViewId) {
        self.image_views
            .borrow_mut()
            .set_image_to_view(image_id, view_id);
    }

    pub(crate) fn get_image_in_view(&self, view_id: ViewId) -> Option<ImageId> {
        self.image_views.borrow().get_image_id(view_id)
    }

    pub(crate) fn get_color_map(&self, name: &str) -> Result<Rc<colormap::ColorMap>> {
        self.color_map_registry
            .borrow()
            .get(name)
            .ok_or(anyhow!("Color map {} not found", name))
    }

    pub(crate) fn get_color_map_texture(
        &self,
        name: &str,
    ) -> Result<Rc<GLGuard<web_sys::WebGlTexture>>> {
        let gl = self
            .gl
            .as_ref()
            .ok_or(anyhow!("WebGL context not initialized"))?;
        let colormap = self.get_color_map(name)?;
        self.color_map_textures_cache
            .borrow_mut()
            .get_or_create(gl, &colormap)
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
            color_map_registry: Default::default(),
            color_map_textures_cache: Default::default(),
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
