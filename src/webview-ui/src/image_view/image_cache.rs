use std::{collections::HashMap, rc::Rc};

use super::types::{ImageId, TextureImage};

pub struct ImageCache {
    cache: HashMap<ImageId, Rc<TextureImage>>,
}

impl ImageCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub fn get(&self, id: &ImageId) -> Option<&Rc<TextureImage>> {
        self.cache.get(id)
    }

    pub fn add(&mut self, image: TextureImage) -> ImageId {
        let key = ImageId::generate();
        self.cache.insert(key.clone(), Rc::new(image));
        key
    }

    pub fn set(&mut self, id: &ImageId, image: TextureImage) {
        self.cache.insert(id.clone(), Rc::new(image));
    }

    pub fn len(&self) -> usize {
        self.cache.len()
    }
}

impl Default for ImageCache {
    fn default() -> Self {
        Self::new()
    }
}
