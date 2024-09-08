use crate::webgl_utils::{self, GLGuard};
use anyhow::Result;

use super::{DataOrdering, ImageData, Size};

pub(crate) struct TextureImage {
    pub image: ImageData,
    pub textures: Vec<GLGuard<web_sys::WebGlTexture>>,
}

impl TextureImage {
    pub(crate) fn try_new(image: ImageData, gl: &web_sys::WebGl2RenderingContext) -> Result<Self> {
        let textures = match image.info.data_ordering {
            DataOrdering::HWC => vec![webgl_utils::textures::create_texture_from_bytes(
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
            )?],

            DataOrdering::CHW => {
                let bytes_per_element = image.info.datatype.num_bytes();
                let plane_size =
                    (image.info.width * image.info.height) as usize * bytes_per_element;
                (0..image.info.channels as usize)
                    .map(|channel| {
                        webgl_utils::textures::create_texture_from_bytes(
                            gl,
                            &image.bytes[plane_size * channel..plane_size * (channel + 1)],
                            image.info.width,
                            image.info.height,
                            1,
                            image.info.datatype,
                            webgl_utils::types::CreateTextureParametersBuilder::default()
                                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                                .wrap_s(webgl_utils::constants::TextureWrap::ClampToEdge)
                                .wrap_t(webgl_utils::constants::TextureWrap::ClampToEdge)
                                .build()
                                .unwrap(),
                        )
                    })
                    .collect::<Result<Vec<_>>>()?
            }
        };

        let image = ImageData::from(image);
        Ok(Self { image, textures })
    }

    pub(crate) fn image_size(&self) -> Size {
        Size {
            width: self.image.info.width as f32,
            height: self.image.info.height as f32,
        }
    }
}
