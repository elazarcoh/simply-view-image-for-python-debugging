use anyhow::Result;
use std::{collections::HashMap, rc::Rc};

use crate::{
    common::{ImageData, ImageId, Size},
    webgl_utils::{self, GLGuard},
};

pub(crate) struct TextureImage {
    pub image: ImageData,
    pub texture: GLGuard<web_sys::WebGlTexture>,
}

impl TextureImage {
    pub(crate) fn try_new(image: ImageData, gl: &web_sys::WebGl2RenderingContext) -> Result<Self> {
        let texture = webgl_utils::textures::create_texture_from_bytes(
            gl,
            &image.bytes,
            image.info.width,
            image.info.height,
            image.info.channels as _,
            image.info.datatype,
            webgl_utils::types::CreateTextureParametersBuilder::default()
                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                .wrap_s(webgl_utils::constants::TextureWrap::ClampToEdge)
                .wrap_t(webgl_utils::constants::TextureWrap::ClampToEdge)
                .build()
                .unwrap(),
        )?;
        let image = ImageData::from(image);
        Ok(Self { image, texture })
    }

    pub(crate) fn image_size(&self) -> Size {
        Size {
            width: self.image.info.width as f32,
            height: self.image.info.height as f32,
        }
    }
}

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
