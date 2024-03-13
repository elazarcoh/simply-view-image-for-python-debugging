use gloo_utils::format::JsValueSerdeExt;
use wasm_bindgen::prelude::*;

use crate::common::viewables::plotly::PlotlyPlot;

#[wasm_bindgen()]
extern "C" {
    #[wasm_bindgen(catch, js_namespace = Plotly, js_name = newPlot)]
    async fn new_plot_(
        id: &str,
        data: &JsValue,
        layout: &JsValue,
        config: &JsValue,
    ) -> Result<JsValue, JsValue>;
}

pub(crate) async fn new_plot(div_id: &str, plot: &PlotlyPlot) {
    let PlotlyPlot {
        data,
        layout,
        config,
    } = plot;
    let data = JsValue::from_serde(data).expect("Failed to serialize data");
    let layout = JsValue::from_serde(layout).expect("Failed to serialize layout");
    let config = JsValue::from_serde(config).expect("Failed to serialize config");

    new_plot_(div_id, data.as_ref(), layout.as_ref(), config.as_ref())
        .await
        .expect("Failed to create new plot");
}
