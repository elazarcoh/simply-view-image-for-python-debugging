use crate::{
    common::{texture_image::TextureImage, ImageId, ImageInfo},
    rendering::coloring::DrawingOptions,
};
use std::{collections::HashMap, rc::Rc};

#[derive(Clone)]
pub(crate) enum ImageAvailability {
    NotAvailable,
    Pending,
    Available(Rc<TextureImage>),
}

impl ImageAvailability {
    pub fn map<U, F>(self, f: F) -> Option<U>
    where
        F: FnOnce(Rc<TextureImage>) -> U,
    {
        match self {
            ImageAvailability::NotAvailable => None,
            ImageAvailability::Pending => None,
            ImageAvailability::Available(image) => Some(f(image)),
        }
    }
}

#[derive(Default)]
pub(crate) struct ImageCache(HashMap<ImageId, ImageAvailability>);

impl ImageCache {
    pub(crate) fn has(&self, id: &ImageId) -> bool {
        self.0.contains_key(id)
    }

    pub(crate) fn get(&self, id: &ImageId) -> ImageAvailability {
        self.0
            .get(id)
            .cloned()
            .unwrap_or(ImageAvailability::NotAvailable)
    }

    pub(crate) fn set(&mut self, id: &ImageId, image: TextureImage) {
        self.0
            .insert(id.clone(), ImageAvailability::Available(Rc::new(image)));
    }

    pub(crate) fn len(&self) -> usize {
        self.0.len()
    }

    pub(crate) fn clear(&mut self) {
        self.0.clear();
    }
}

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
