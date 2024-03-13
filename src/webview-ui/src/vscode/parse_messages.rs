use std::convert::{TryFrom, TryInto};

use crate::{
    app_state::app_state::ViewableObject,
    common::{
        pixel_value::PixelValue,
        viewables::{
            image::{ComputedInfo, ImageData, ImageInfo},
            plotly::{PlotlyData, PlotlyInfo},
            viewables::{ViewableData, ViewableInfo},
        },
    },
    math_utils::image_calculations::image_minmax_on_bytes,
};

use super::messages::{ImageMessage, PlotlyMessage, ViewableObjectMessage};

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

impl TryFrom<ImageMessage> for ViewableObject {
    type Error = anyhow::Error;

    fn try_from(image_message: ImageMessage) -> Result<Self, Self::Error> {
        match &image_message.bytes {
            Some(_) => Ok(ViewableObject::WithData(ViewableData::Image(
                ImageData::try_from(image_message)?,
            ))),
            None => Ok(ViewableObject::InfoOnly(ViewableInfo::Image(
                ImageInfo::from(image_message),
            ))),
        }
    }
}

impl From<PlotlyMessage> for PlotlyInfo {
    fn from(message: PlotlyMessage) -> Self {
        Self {
            id: message.image_id,
            value_variable_kind: message.value_variable_kind,
            expression: message.expression,
            additional_info: message.additional_info,
        }
    }
}

impl TryFrom<PlotlyMessage> for PlotlyData {
    type Error = anyhow::Error;

    fn try_from(message: PlotlyMessage) -> Result<Self, Self::Error> {
        if message.plot.is_some() {
            let PlotlyMessage { plot, .. } = message;
            let info = PlotlyInfo {
                id: message.image_id,
                value_variable_kind: message.value_variable_kind,
                expression: message.expression,
                additional_info: message.additional_info,
            };

            Ok(Self {
                info,
                plot: plot.unwrap(),
            })
        } else {
            return Err(anyhow::anyhow!("PlotlyMessage without plot data"));
        }
    }
}

impl TryFrom<PlotlyMessage> for ViewableObject {
    type Error = anyhow::Error;

    fn try_from(message: PlotlyMessage) -> Result<Self, Self::Error> {
        match &message.plot {
            Some(_) => Ok(ViewableObject::WithData(ViewableData::Plotly(
                PlotlyData::try_from(message)?,
            ))),
            None => Ok(ViewableObject::InfoOnly(ViewableInfo::Plotly(
                PlotlyInfo::from(message),
            ))),
        }
    }
}

impl TryFrom<ViewableObjectMessage> for ViewableObject {
    type Error = anyhow::Error;

    fn try_from(message: ViewableObjectMessage) -> Result<Self, Self::Error> {
        match message {
            ViewableObjectMessage::Image(image_message) => image_message.try_into(),
            ViewableObjectMessage::Plotly(plotly_message) => plotly_message.try_into(),
        }
    }
}
