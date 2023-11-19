use crate::webgl_utils::{self, GLGuard};
use anyhow::Result;

use super::{ImageData, Size};

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
