use crate::common::{ImageId, ValueVariableKind};

use super::image::{ImageData, ImageInfo};
use super::plotly::{PlotlyData, PlotlyInfo};

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum ViewableInfo {
    Image(ImageInfo),
    Plotly(PlotlyInfo),
}

impl ViewableInfo {
    pub(crate) fn id(&self) -> &ImageId {
        match self {
            ViewableInfo::Image(info) => &info.image_id,
            ViewableInfo::Plotly(info) => &info.id,
        }
    }
    pub(crate) fn value_variable_kind(&self) -> &ValueVariableKind {
        match self {
            ViewableInfo::Image(info) => &info.value_variable_kind,
            ViewableInfo::Plotly(info) => &info.value_variable_kind,
        }
    }
    pub(crate) fn expression(&self) -> &str {
        match self {
            ViewableInfo::Image(info) => &info.expression,
            ViewableInfo::Plotly(info) => &info.expression,
        }
    }
    pub(crate) fn additional_info(&self) -> &std::collections::HashMap<String, String> {
        match self {
            ViewableInfo::Image(info) => &info.additional_info,
            ViewableInfo::Plotly(info) => &info.additional_info,
        }
    }
}

pub(crate) enum ViewableData {
    Image(ImageData),
    Plotly(PlotlyData),
}

impl ViewableData {
    pub(crate) fn info(&self) -> ViewableInfo {
        match self {
            ViewableData::Image(data) => ViewableInfo::Image(data.info.clone()),
            ViewableData::Plotly(data) => ViewableInfo::Plotly(data.info.clone()),
        }
    }
}
