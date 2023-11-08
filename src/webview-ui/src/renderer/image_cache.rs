use std::collections::HashMap;

use image::DynamicImage;

#[derive(PartialEq)]
pub struct Image {
    pub image: DynamicImage,
}

impl Image {
    pub fn new(image: DynamicImage) -> Self {
        Self { image }
    }
}

#[derive(PartialEq)]
pub struct ImageCache {
    cache: HashMap<String, Image>,
}

impl ImageCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub fn get(&self, key: &str) -> Option<&Image> {
        self.cache.get(key)
    }

    pub fn insert(&mut self, key: String, image: Image) {
        self.cache.insert(key, image);
    }
}
