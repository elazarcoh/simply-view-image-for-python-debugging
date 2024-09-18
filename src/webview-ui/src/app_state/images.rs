use yewdux::mrc::Mrc;

use crate::{
    coloring::DrawingOptions,
    common::{texture_image::TextureImage, ImageInfo, ViewableObjectId},
};
use std::{collections::HashMap, rc::Rc};

#[derive(Clone)]
pub(crate) enum ImageAvailability {
    NotAvailable,
    Pending,
    Available(Mrc<TextureImage>),
}

impl PartialEq for ImageAvailability {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Available(l0), Self::Available(r0)) => Mrc::eq(l0, r0),
            _ => core::mem::discriminant(self) == core::mem::discriminant(other),
        }
    }
}

impl ImageAvailability {
    pub fn map<U, F>(self, f: F) -> Option<U>
    where
        F: FnOnce(Mrc<TextureImage>) -> U,
    {
        match self {
            ImageAvailability::NotAvailable => None,
            ImageAvailability::Pending => None,
            ImageAvailability::Available(image) => Some(f(image)),
        }
    }
}

#[derive(Default)]
pub(crate) struct ImageCache(HashMap<ViewableObjectId, ImageAvailability>);

impl ImageCache {
    pub(crate) fn has(&self, id: &ViewableObjectId) -> bool {
        self.0.contains_key(id)
    }

    pub(crate) fn get(&self, id: &ViewableObjectId) -> ImageAvailability {
        self.0
            .get(id)
            .cloned()
            .unwrap_or(ImageAvailability::NotAvailable)
    }

    pub(crate) fn set_pending(&mut self, id: &ViewableObjectId) {
        self.0.insert(id.clone(), ImageAvailability::Pending);
    }

    pub(crate) fn set(&mut self, id: &ViewableObjectId, image: TextureImage) {
        self.0
            .insert(id.clone(), ImageAvailability::Available(Mrc::new(image)));
    }

    pub(crate) fn update(&mut self, id: &ViewableObjectId, image: TextureImage) {
        if let Some(ImageAvailability::Available(current_rc)) =
            self.0.insert(id.clone(), ImageAvailability::Pending)
        {
            current_rc.with_mut(|current| current.update(image));
            self.0
                .insert(id.clone(), ImageAvailability::Available(current_rc));
        } else {
            self.set(id, image);
        }
    }

    pub(crate) fn clear(&mut self) {
        self.0.clear();
    }
}

#[derive(Default)]
pub(crate) struct Images {
    data: HashMap<ViewableObjectId, ImageInfo>,
    order: Vec<ViewableObjectId>,
    pinned: Vec<ViewableObjectId>,
}

impl Images {
    pub fn get(&self, image_id: &ViewableObjectId) -> Option<&ImageInfo> {
        self.data.get(image_id)
    }

    pub fn insert(&mut self, image_id: ViewableObjectId, image_info: ImageInfo) {
        if self.data.insert(image_id.clone(), image_info).is_none() {
            self.order.push(image_id);
        }
    }

    pub fn clear(&mut self) {
        self.data.clear();
        self.order.clear();
        self.pinned.clear();
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = (&ViewableObjectId, &ImageInfo)> {
        let iter_item = move |id| self.data.get(id).map(|info| (id, info));
        // first pinned images, then unpinned images
        self.pinned.iter().filter_map(iter_item).chain(
            self.order
                .iter()
                .filter(move |id| !self.is_pinned(id))
                .filter_map(iter_item),
        )
    }

    pub fn next_image_id(&self, current_image_id: &ViewableObjectId) -> Option<&ViewableObjectId> {
        self.iter()
            .skip_while(|(id, _)| *id != current_image_id)
            .skip(1)
            .map(|(id, _)| id)
            .next()
    }

    pub fn previous_image_id(
        &self,
        current_image_id: &ViewableObjectId,
    ) -> Option<&ViewableObjectId> {
        self.iter()
            .rev()
            .skip_while(|(id, _)| *id != current_image_id)
            .skip(1)
            .map(|(id, _)| id)
            .next()
    }

    pub fn pin(&mut self, image_id: &ViewableObjectId) {
        if !self.is_pinned(image_id) {
            self.pinned.insert(0, image_id.clone());
        }
    }

    pub fn unpin(&mut self, image_id: &ViewableObjectId) {
        if let Some(index) = self.pinned.iter().position(|id| id == image_id) {
            self.pinned.remove(index);
        }
    }

    pub fn is_pinned(&self, image_id: &ViewableObjectId) -> bool {
        self.pinned.iter().any(|id| id == image_id)
    }
}

#[derive(Default)]
pub(crate) struct ImagesDrawingOptions(HashMap<ViewableObjectId, DrawingOptions>);

impl ImagesDrawingOptions {
    pub(crate) fn set(&mut self, image_id: ViewableObjectId, drawing_options: DrawingOptions) {
        self.0.insert(image_id, drawing_options);
    }

    pub(crate) fn get_or_default(&self, image_id: &ViewableObjectId) -> DrawingOptions {
        self.0
            .get(image_id)
            .cloned()
            .unwrap_or(DrawingOptions::default())
    }

    pub(crate) fn get(&self, image_id: &ViewableObjectId) -> Option<DrawingOptions> {
        self.0.get(image_id).cloned()
    }
}
