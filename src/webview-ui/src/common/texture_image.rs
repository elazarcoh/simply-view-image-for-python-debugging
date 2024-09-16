use std::{collections::HashMap, iter::FromIterator};

use crate::{
    math_utils::image_calculations::{calc_num_bytes_per_image, calc_num_bytes_per_plane},
    webgl_utils::{self, GLGuard},
};
use anyhow::Result;

use super::{Channels, DataOrdering, Datatype, ImageData, Size};

#[allow(non_camel_case_types)]
pub(crate) enum TexturesGroup {
    HWC(GLGuard<web_sys::WebGlTexture>),
    CHW_G {
        gray: GLGuard<web_sys::WebGlTexture>,
    },
    CHW_GA {
        gray: GLGuard<web_sys::WebGlTexture>,
        alpha: GLGuard<web_sys::WebGlTexture>,
    },
    CHW_RGB {
        red: GLGuard<web_sys::WebGlTexture>,
        green: GLGuard<web_sys::WebGlTexture>,
        blue: GLGuard<web_sys::WebGlTexture>,
    },
    CHW_RGBA {
        red: GLGuard<web_sys::WebGlTexture>,
        green: GLGuard<web_sys::WebGlTexture>,
        blue: GLGuard<web_sys::WebGlTexture>,
        alpha: GLGuard<web_sys::WebGlTexture>,
    },
}

pub(crate) struct TextureImage {
    pub image: ImageData,
    pub textures: HashMap<u32, TexturesGroup>,
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

    fn make_textures_group(
        image: &ImageData,
        gl: &web_sys::WebGl2RenderingContext,
        offset: usize,
    ) -> Result<TexturesGroup> {
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
                Ok(TexturesGroup::HWC(texture))
            }

            DataOrdering::CHW => {
                let plane_size = calc_num_bytes_per_plane(
                    image.info.width,
                    image.info.height,
                    image.info.datatype,
                );

                let make_texture_for_channel = |channel: usize| {
                    Self::make_texture(
                        gl,
                        &image.bytes[offset + plane_size * channel..plane_size * (channel + 1)],
                        image.info.width,
                        image.info.height,
                        Channels::One,
                        image.info.datatype,
                    )
                };

                match image.info.channels {
                    Channels::One => {
                        let gray = make_texture_for_channel(0)?;
                        Ok(TexturesGroup::CHW_G { gray })
                    }
                    Channels::Two => {
                        let gray = make_texture_for_channel(0)?;
                        let alpha = make_texture_for_channel(1)?;
                        Ok(TexturesGroup::CHW_GA { gray, alpha })
                    }
                    Channels::Three => {
                        let red = make_texture_for_channel(0)?;
                        let green = make_texture_for_channel(1)?;
                        let blue = make_texture_for_channel(2)?;
                        Ok(TexturesGroup::CHW_RGB { red, green, blue })
                    }
                    Channels::Four => {
                        let red = make_texture_for_channel(0)?;
                        let green = make_texture_for_channel(1)?;
                        let blue = make_texture_for_channel(2)?;
                        let alpha = make_texture_for_channel(3)?;
                        Ok(TexturesGroup::CHW_RGBA {
                            red,
                            green,
                            blue,
                            alpha,
                        })
                    }
                }
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
                    let textures = Self::make_textures_group(
                        &image,
                        gl,
                        (batch_item as usize * batch_item_size) as usize,
                    )?;
                    Ok((batch_item, textures))
                })
                .collect::<Result<Vec<_>>>()?
                .into_iter()
                .map(|(batch_item, textures)| Ok((batch_item, textures)))
                .collect::<Result<HashMap<_, _>>>()
        } else {
            let textures = Self::make_textures_group(&image, gl, 0)?;
            Ok(HashMap::from_iter([(0u32, textures)]))
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
