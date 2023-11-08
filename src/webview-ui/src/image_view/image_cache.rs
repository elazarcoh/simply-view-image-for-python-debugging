use std::{collections::HashMap, rc::Rc};

use super::types::{ImageId, TextureImage};

pub(crate) struct ImageCache {
    cache: HashMap<ImageId, Rc<TextureImage>>,
}

impl ImageCache {
    pub(crate) fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub(crate) fn has(&self, id: &ImageId) -> bool {
        self.cache.contains_key(id)
    }

    pub(crate) fn get(&self, id: &ImageId) -> Option<&Rc<TextureImage>> {
        self.cache.get(id)
    }

    pub(crate) fn add(&mut self, image: TextureImage) -> ImageId {
        let key = ImageId::generate();
        self.cache.insert(key.clone(), Rc::new(image));
        key
    }

    pub(crate) fn set(&mut self, id: &ImageId, image: TextureImage) {
        self.cache.insert(id.clone(), Rc::new(image));
    }

    pub(crate) fn len(&self) -> usize {
        self.cache.len()
    }

    pub(crate) fn clear(&mut self) {
        self.cache.clear();
    }
}

impl Default for ImageCache {
    fn default() -> Self {
        Self::new()
    }
}
