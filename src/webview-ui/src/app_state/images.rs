use crate::{
    common::{ImageId, ImageInfo},
    rendering::coloring::DrawingOptions,
};
use std::collections::HashMap;

#[derive(Default)]
pub(crate) struct Images {
    data: HashMap<ImageId, ImageInfo>,
    order: Vec<ImageId>,
}

impl Images {
    pub fn get(&self, image_id: &ImageId) -> Option<&ImageInfo> {
        self.data.get(image_id)
    }

    pub fn insert(&mut self, image_id: ImageId, image_info: ImageInfo) {
        if self.data.insert(image_id.clone(), image_info).is_none() {
            self.order.push(image_id);
        }
    }

    pub fn clear(&mut self) {
        self.data.clear();
        self.order.clear();
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&ImageId, &ImageInfo)> {
        self.order
            .iter()
            .filter_map(move |id| self.data.get(id).map(|info| (id, info)))
    }
}

#[derive(Default)]
pub(crate) struct ImagesDrawingOptions(HashMap<ImageId, DrawingOptions>);

impl ImagesDrawingOptions {
    pub(crate) fn set(&mut self, image_id: ImageId, drawing_options: DrawingOptions) {
        self.0.insert(image_id, drawing_options);
    }

    pub(crate) fn get_or_default(&self, image_id: &ImageId) -> DrawingOptions {
        self.0
            .get(image_id)
            .cloned()
            .unwrap_or(DrawingOptions::default())
    }
}
