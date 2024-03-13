use crate::common::{ImageId, ValueVariableKind};

#[derive(tsify::Tsify, serde::Deserialize, Debug, PartialEq)]
pub(crate) struct PlotlyPlot {
    pub data: serde_json::Value,
    pub layout: serde_json::Value,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct PlotlyInfo {
    pub id: ImageId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
    pub additional_info: std::collections::HashMap<String, String>,
}

pub(crate) struct PlotlyData {
    pub info: PlotlyInfo,
    pub plot: PlotlyPlot,
}
