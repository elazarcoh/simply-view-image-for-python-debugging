use std::{collections::HashMap, fmt, iter::FromIterator};

use crate::{
    math_utils::image_calculations::{calc_num_bytes_per_image, calc_num_bytes_per_plane},
    webgl_utils::{self, GLGuard},
};
use anyhow::Result;

use super::{
    Channels, ComputedInfo, DataOrdering, Datatype, ImageData, ImageInfo, Size, ValueVariableKind,
    ViewableObjectId,
};

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

// #[derive(Debug, Clone, PartialEq)]
// pub(crate) struct TextureImageInfo {
//     pub image_id: ViewableObjectId,
//     pub value_variable_kind: ValueVariableKind,
//     pub expression: String,
//     pub width: u32,
//     pub height: u32,
//     pub channels: Channels,
//     pub datatype: Datatype,
//     pub batch_info: Option<BatchInfo>,
//     pub data_ordering: DataOrdering,
//     pub additional_info: HashMap<String, String>,
// }

pub(crate) struct TextureImage {
    pub info: ImageInfo,
    pub computed_info: ComputedInfo,
    pub bytes: HashMap<u32, Vec<u8>>,
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
                        &image.bytes
                            [offset + plane_size * channel..offset + plane_size * (channel + 1)],
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
        let info = image.info.clone();
        let computed_info = image.computed_info.clone();

        let items = if let Some(batch_info) = &image.info.batch_info {
            // Create textures for each batch item
            let (start, end) = batch_info.batch_items_range;
            let batch_item_size = calc_num_bytes_per_image(
                image.info.width,
                image.info.height,
                image.info.channels,
                image.info.datatype,
            );

            (start..end)
                .map(|index| {
                    let offset = ((index - start) as usize * batch_item_size) as usize;
                    let textures = Self::make_textures_group(&image, gl, offset)?;
                    let bytes = image.bytes[offset..offset + batch_item_size].to_vec();

                    Ok((index, textures, bytes))
                })
                .collect::<Result<Vec<_>>>()?
                .into_iter()
                .map(|(batch_item, textures, bytes)| Ok((batch_item, (textures, bytes))))
                .collect::<Result<HashMap<_, _>>>()
        } else {
            let textures = Self::make_textures_group(&image, gl, 0)?;
            let bytes = image.bytes;
            Ok(HashMap::from_iter([(0u32, (textures, bytes))]))
        }?;

        let (textures, bytes): (Vec<_>, Vec<_>) = items
            .into_iter()
            .map(|(k, (v1, v2))| ((k, v1), (k, v2)))
            .unzip();
        let textures = HashMap::from_iter(textures);
        let bytes = HashMap::from_iter(bytes);

        Ok(Self {
            info,
            computed_info,
            bytes,
            textures,
        })
    }

    pub(crate) fn image_size(&self) -> Size {
        Size {
            width: self.info.width as f32,
            height: self.info.height as f32,
        }
    }

    pub(crate) fn update(&mut self, other: TextureImage) {
        // TODO verify that the other image has the same info

        self.bytes.extend(other.bytes);
        self.textures.extend(other.textures);

        // TODO update computed info
    }
}

impl fmt::Debug for TextureImage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TextureImage")
            .field("info", &self.info)
            .field("computed_info", &self.computed_info)
            .field("bytes", &format!("[{} bytes]", self.bytes.len()))
            .finish()
    }
}
