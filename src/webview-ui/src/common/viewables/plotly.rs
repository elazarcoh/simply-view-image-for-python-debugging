use crate::common::{ImageId, ValueVariableKind};

#[derive(tsify::Tsify, serde::Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct PlotlyPlot {
    data: Vec<serde_json::Value>,
    layout: serde_json::Value,
    config: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct PlotlyInfo {
    pub id: ImageId,
    pub value_variable_kind: ValueVariableKind,
    pub expression: String,
}

pub(crate) struct PlotlyData {
    pub info: PlotlyInfo,
    pub plot: PlotlyPlot,
}
