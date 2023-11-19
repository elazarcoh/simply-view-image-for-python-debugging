use std::convert::TryFrom;

use crate::{
    common::{ComputedInfo, ImageData, ImageInfo},
    math_utils::image_calculations::image_minmax_on_bytes, app_state::app_state::ImageObject,
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
            };

            let (min, max) =
                image_minmax_on_bytes(bytes.as_ref().unwrap(), info.datatype, info.channels);
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
