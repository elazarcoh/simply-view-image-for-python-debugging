use std::collections::HashMap;

use crate::{
    math_utils::image_calculations::{calc_num_bytes_per_image, calc_num_bytes_per_plane},
    webgl_utils::{self, GLGuard},
};
use anyhow::Result;

use super::{Channels, DataOrdering, Datatype, ImageData, Size};

pub(crate) struct TextureImage {
    pub image: ImageData,
    pub textures: HashMap<u32, GLGuard<web_sys::WebGlTexture>>,
}

impl TextureImage {
    fn make_texture(
        gl: &web_sys::WebGl2RenderingContext,
        bytes: &[u8],
        width: u32,
        height: u32,
        channels: Channels,
        datatype: Datatype,
    ) -> Result<GLGuard<web_sys::WebGlTexture>> {
        webgl_utils::textures::create_texture_from_bytes(
            gl,
            &bytes,
            width,
            height,
            channels as _,
            datatype,
            webgl_utils::types::CreateTextureParametersBuilder::default()
                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                .wrap_s(webgl_utils::constants::TextureWrap::ClampToEdge)
                .wrap_t(webgl_utils::constants::TextureWrap::ClampToEdge)
                .build()
                .unwrap(),
        )
    }

    fn make_textures(
        image: &ImageData,
        gl: &web_sys::WebGl2RenderingContext,
        offset: usize,
    ) -> Result<HashMap<u32, GLGuard<web_sys::WebGlTexture>>> {
        match image.info.data_ordering {
            DataOrdering::HWC => {
                let texture = Self::make_texture(
                    gl,
                    &image.bytes[offset..],
                    image.info.width,
                    image.info.height,
                    image.info.channels,
                    image.info.datatype,
                )?;
                Ok(HashMap::from([(0u32, texture)]))
            }

            DataOrdering::CHW => {
                let plane_size = calc_num_bytes_per_plane(
                    image.info.width,
                    image.info.height,
                    image.info.datatype,
                );

                (0..image.info.channels as usize)
                    .map(|channel| {
                        let texture = Self::make_texture(
                            gl,
                            &image.bytes[offset + plane_size * channel..plane_size * (channel + 1)],
                            image.info.width,
                            image.info.height,
                            Channels::One,
                            image.info.datatype,
                        )?;
                        Ok((channel as u32, texture))
                    })
                    .collect::<Result<HashMap<_, _>>>()
            }
        }
    }

    pub(crate) fn try_new(image: ImageData, gl: &web_sys::WebGl2RenderingContext) -> Result<Self> {
        let textures = if let Some(batch_info) = &image.info.batch_info {
            // Create textures for each batch item
            let (start, end) = batch_info.batch_items_range;
            let batch_item_size = calc_num_bytes_per_image(
                image.info.width,
                image.info.height,
                image.info.channels,
                image.info.datatype,
            );

            (start..end)
                .map(|batch_item| {
                    let textures = Self::make_textures(
                        &image,
                        gl,
                        (batch_item as usize * batch_item_size) as usize,
                    )?;
                    Ok((batch_item, textures))
                })
                .collect::<Result<Vec<_>>>()?
                .into_iter()
                .map(|(batch_item, textures)| {
                    let channels = image.info.channels as u32;
                    textures.into_iter().map(move |(channel, texture)| {
                        Ok((batch_item * channels + channel, texture))
                    })
                })
                .flatten()
                .collect::<Result<HashMap<_, _>>>()
        } else {
            Self::make_textures(&image, gl, 0usize)
        }?;

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
