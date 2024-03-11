use crate::common::{texture_image::TextureImage, ImageAvailability, ImageId};
use std::{collections::HashMap, rc::Rc};

#[derive(Default)]
pub(crate) struct ViewablesCache(HashMap<ImageId, ImageAvailability>);

impl ViewablesCache {
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
        self.0.insert(
            id.clone(),
            ImageAvailability::ImageAvailable(Rc::new(image)),
        );
    }

    pub(crate) fn clear(&mut self) {
        self.0.clear();
    }
}
