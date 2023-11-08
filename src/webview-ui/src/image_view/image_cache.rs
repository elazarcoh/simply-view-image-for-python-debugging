use std::collections::HashMap;

use super::types::{TextureImage, ImageId};



pub struct ImageCache {
    cache: HashMap<ImageId, TextureImage>,
}

impl ImageCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub fn get(&self, key: &ImageId) -> Option<&TextureImage> {
        self.cache.get(key)
    }

    pub fn add(&mut self, image: TextureImage)  -> ImageId {
        let key = ImageId::generate();
        self.cache.insert(key.clone(), image);
        key
    }
}
