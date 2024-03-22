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

impl PartialEq for ImageAvailability {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Available(l0), Self::Available(r0)) => Rc::ptr_eq(l0, r0),
            _ => core::mem::discriminant(self) == core::mem::discriminant(other),
        }
    }
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

    pub(crate) fn set_pending(&mut self, id: &ImageId) {
        self.0.insert(id.clone(), ImageAvailability::Pending);
    }

    pub(crate) fn set(&mut self, id: &ImageId, image: TextureImage) {
        self.0
            .insert(id.clone(), ImageAvailability::Available(Rc::new(image)));
    }

    pub(crate) fn clear(&mut self) {
        self.0.clear();
    }
}

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

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = (&ImageId, &ImageInfo)> {
        self.order
            .iter()
            .filter_map(move |id| self.data.get(id).map(|info| (id, info)))
    }

    pub fn next_image_id(&self, current_image_id: &ImageId) -> Option<&ImageId> {
        let current_index = self.order.iter().position(|id| id == current_image_id)?;
        self.order.get(current_index + 1)
    }

    pub fn previous_image_id(&self, current_image_id: &ImageId) -> Option<&ImageId> {
        let current_index = self.order.iter().position(|id| id == current_image_id)?;
        self.order.get(current_index.checked_sub(1)?)
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
