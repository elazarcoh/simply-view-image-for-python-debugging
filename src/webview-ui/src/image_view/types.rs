

use image::DynamicImage;

use crate::{
    common::Size,
    webgl_utils::{self, types::GLGuard},
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ImageId(String);

impl ImageId {
    pub fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        Self(uuid.to_string())
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum ViewId {
    Primary,
}

pub fn all_views() -> Vec<ViewId> {
    vec![ViewId::Primary]
}

#[derive(Debug)]
pub struct TextureImage {
    pub image: DynamicImage,
    pub texture: GLGuard<web_sys::WebGlTexture>,
}

impl TextureImage {
    pub fn try_new(
        image: DynamicImage,
        gl: &web_sys::WebGl2RenderingContext,
    ) -> Result<Self, String> {
        let texture = webgl_utils::textures::create_texture_from_image(
            gl,
            &image,
            webgl_utils::types::CreateTextureParametersBuilder::default()
                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                .build()
                .unwrap(),
        )?;
        Ok(Self { image, texture })
    }

    pub fn image_size(&self) -> Size {
        Size {
            width: self.image.width() as f32,
            height: self.image.height() as f32,
        }
    }
}
