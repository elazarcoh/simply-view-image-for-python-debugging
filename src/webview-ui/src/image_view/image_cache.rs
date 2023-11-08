use std::{collections::HashMap, rc::Rc};

use super::types::{TextureImage, ImageId};



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

    pub fn add(&mut self, image: TextureImage)  -> ImageId {
        let key = ImageId::generate();
        self.cache.insert(key.clone(), Rc::new(image));
        key
    }
}
