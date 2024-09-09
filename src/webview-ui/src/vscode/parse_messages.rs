use std::convert::{TryFrom, TryInto};

use crate::{
    app_state::app_state::ImageObject,
    common::{pixel_value::PixelValue, ComputedInfo, ImageData, ImageInfo},
    math_utils::image_calculations::image_minmax_on_bytes,
};

use super::messages::ImageMessage;

impl From<ImageMessage> for ImageInfo {
    fn from(image_message: ImageMessage) -> Self {
        Self {
            image_id: image_message.image_id,
            value_variable_kind: image_message.value_variable_kind,
            expression: image_message.expression,
            width: image_message.width,
            height: image_message.height,
            channels: image_message.channels,
            datatype: image_message.datatype,
            data_ordering: image_message.data_ordering,
            batch_info: image_message
                .batch_size
                .zip(image_message.batch_items_range)
                .map(|(batch_size, batch_items_range)| crate::common::BatchInfo {
                    batch_size,
                    batch_items_range,
                }),
            additional_info: image_message.additional_info,
        }
    }
}

impl TryFrom<ImageMessage> for ImageData {
    type Error = anyhow::Error;

    fn try_from(image_message: ImageMessage) -> Result<Self, Self::Error> {
        if image_message.bytes.is_some() {
            let ImageMessage { bytes, .. } = image_message;
            let info = ImageInfo {
                image_id: image_message.image_id,
                value_variable_kind: image_message.value_variable_kind,
                expression: image_message.expression,
                width: image_message.width,
                height: image_message.height,
                channels: image_message.channels,
                datatype: image_message.datatype,
                data_ordering: image_message.data_ordering,
                batch_info: image_message
                    .batch_size
                    .zip(image_message.batch_items_range)
                    .map(|(batch_size, batch_items_range)| crate::common::BatchInfo {
                        batch_size,
                        batch_items_range,
                    }),
                additional_info: image_message.additional_info,
            };

            let (min, max) = if image_message.min.is_some() && image_message.max.is_some() {
                (
                    TryInto::<PixelValue>::try_into(image_message.min.unwrap())?,
                    TryInto::<PixelValue>::try_into(image_message.max.unwrap())?,
                )
            } else {
                image_minmax_on_bytes(bytes.as_ref().unwrap(), info.datatype, info.channels)
            };

            Ok(Self {
                info,
                computed_info: ComputedInfo { min, max },
                bytes: bytes.unwrap(),
            })
        } else {
            return Err(anyhow::anyhow!("ImageMessage without image data"));
        }
    }
}

impl TryFrom<ImageMessage> for ImageObject {
    type Error = anyhow::Error;

    fn try_from(image_message: ImageMessage) -> Result<Self, Self::Error> {
        match &image_message.bytes {
            Some(_) => Ok(ImageObject::WithData(ImageData::try_from(image_message)?)),
            None => Ok(ImageObject::InfoOnly(ImageInfo::from(image_message))),
        }
    }
}
