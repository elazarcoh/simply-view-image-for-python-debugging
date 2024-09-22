use std::convert::{TryFrom, TryInto};

use crate::{
    app_state::app_state::ImageObject,
    common::{pixel_value::PixelValue, ComputedInfo, ImageData, ImageInfo, ImagePlaceholder},
    math_utils::image_calculations::image_minmax_on_bytes,
};

use super::messages::{ImageMessage, ImagePlaceholderMessage};

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
                .is_batched
                .then_some(crate::common::BatchInfo {
                    batch_size: image_message.batch_size.unwrap_or_default(),
                    batch_items_range: image_message.batch_items_range.unwrap_or_default(),
                }),
            additional_info: image_message.additional_info,
        }
    }
}

impl TryFrom<ImageMessage> for ImageData {
    type Error = anyhow::Error;

    fn try_from(image_message: ImageMessage) -> Result<Self, Self::Error> {
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
            image_minmax_on_bytes(&bytes, info.datatype, info.channels)
        };

        Ok(Self {
            info,
            computed_info: ComputedInfo { min, max },
            bytes: bytes,
        })
    }
}

impl TryFrom<ImageMessage> for ImageObject {
    type Error = anyhow::Error;

    fn try_from(image_message: ImageMessage) -> Result<Self, Self::Error> {
        ImageData::try_from(image_message).map(ImageObject::WithData)
    }
}

impl From<ImagePlaceholderMessage> for ImagePlaceholder {
    fn from(image_placeholder_message: ImagePlaceholderMessage) -> Self {
        Self {
            image_id: image_placeholder_message.image_id,
            value_variable_kind: image_placeholder_message.value_variable_kind,
            expression: image_placeholder_message.expression,
            additional_info: image_placeholder_message.additional_info,
        }
    }
}

impl TryFrom<ImagePlaceholderMessage> for ImageObject {
    type Error = anyhow::Error;

    fn try_from(image_placeholder_message: ImagePlaceholderMessage) -> Result<Self, Self::Error> {
        Ok(ImageObject::Placeholder(ImagePlaceholder::from(
            image_placeholder_message,
        )))
    }
}
