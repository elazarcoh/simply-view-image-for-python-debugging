use anyhow::{anyhow, Result};
use yewdux::mrc::Mrc;

use crate::{
    coloring::DrawingOptions,
    common::{texture_image::TextureImage, Image, SessionId, ViewableObjectId},
};
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub(crate) enum ImageAvailability {
    NotAvailable,
    Pending(Option<Mrc<TextureImage>>),
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
            ImageAvailability::Pending(_) => None,
            ImageAvailability::Available(image) => Some(f(image)),
        }
    }
}

#[derive(Default)]
pub(crate) struct ImageCache(HashMap<ViewableObjectId, ImageAvailability>);

impl ImageCache {
    pub(crate) fn get(&self, id: &ViewableObjectId) -> ImageAvailability {
        self.0
            .get(id)
            .cloned()
            .unwrap_or(ImageAvailability::NotAvailable)
    }

    pub(crate) fn set_pending(&mut self, id: &ViewableObjectId) {
        if let Some(ImageAvailability::Pending(_)) = self.0.get(id) {
            // do nothing
        } else if let Some(ImageAvailability::Available(current)) = self.0.remove(id) {
            self.0
                .insert(id.clone(), ImageAvailability::Pending(Some(current)));
        } else {
            self.0.insert(id.clone(), ImageAvailability::Pending(None));
        }
    }

    pub(crate) fn try_set_available(&mut self, id: &ViewableObjectId) -> Result<()> {
        if let Some(ImageAvailability::Available(_)) = self.0.get(id) {
            Ok(())
        } else if let Some(ImageAvailability::Pending(Some(image))) = self.0.remove(id) {
            self.0
                .insert(id.clone(), ImageAvailability::Available(image));
            Ok(())
        } else {
            Err(anyhow!("Image not pending: {:?}", id))
        }
    }

    pub(crate) fn set_image(&mut self, id: &ViewableObjectId, image: TextureImage) {
        self.0
            .insert(id.clone(), ImageAvailability::Available(Mrc::new(image)));
    }

    pub(crate) fn update(&mut self, id: &ViewableObjectId, image: TextureImage) {
        match self.0.remove_entry(id) {
            Some((id, ImageAvailability::Available(current)))
            | Some((id, ImageAvailability::Pending(Some(current)))) => {
                current.with_mut(|img| img.update(image));
                self.0.insert(id, ImageAvailability::Available(current));
            }
            _ => self.set_image(id, image),
        }
    }

    pub(crate) fn clear(&mut self) {
        self.0.clear();
    }
}

#[derive(Default)]
pub(crate) struct Images {
    data: HashMap<ViewableObjectId, Image>,
    order: Vec<ViewableObjectId>,
    pinned: Vec<ViewableObjectId>,
}

impl Images {
    pub fn get(&self, image_id: &ViewableObjectId) -> Option<&Image> {
        self.data.get(image_id)
    }

    pub fn pinned(&self) -> &[ViewableObjectId] {
        &self.pinned
    }

    pub fn insert(&mut self, image_id: ViewableObjectId, image_info: Image) {
        if self.data.insert(image_id.clone(), image_info).is_none() {
            self.order.push(image_id);
        }
    }

    pub fn clear(&mut self, session_id: &SessionId) {
        self.data.retain(|id, _| id.session_id() != session_id);
        self.order.retain(|id| id.session_id() != session_id);
        self.pinned.retain(|id| id.session_id() != session_id);
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = (&ViewableObjectId, &Image)> {
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

    pub(crate) fn mut_ref_or_default(&mut self, image_id: ViewableObjectId) -> &mut DrawingOptions {
        self.0.entry(image_id).or_default()
    }
}
