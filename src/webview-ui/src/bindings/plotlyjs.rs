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

    #[wasm_bindgen(catch, js_namespace = Plotly, js_name = restyle)]
    async fn restyle_(id: &str, update: &JsValue, traces: &JsValue) -> Result<JsValue, JsValue>;

    #[wasm_bindgen(catch, js_namespace = Plotly, js_name = update)]
    async fn update_(
        id: &str,
        data_update: &JsValue,
        layout_update: &JsValue,
    ) -> Result<JsValue, JsValue>;

    #[wasm_bindgen(catch, js_namespace = Plotly, js_name = relayout)]
    async fn relayout_(id: &str, layout_update: &JsValue) -> Result<JsValue, JsValue>;

    #[wasm_bindgen(catch, js_namespace = ["Plotly", "Plots"], js_name = resize)]
    async fn resize_(id: &str) -> Result<JsValue, JsValue>;

}

const TEMPLATE: &str = "{\"data\": {\"histogram2dcontour\": [{\"type\": \"histogram2dcontour\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}, \"colorscale\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]]}], \"choropleth\": [{\"type\": \"choropleth\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}], \"histogram2d\": [{\"type\": \"histogram2d\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}, \"colorscale\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]]}], \"heatmap\": [{\"type\": \"heatmap\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}, \"colorscale\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]]}], \"heatmapgl\": [{\"type\": \"heatmapgl\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}, \"colorscale\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]]}], \"contourcarpet\": [{\"type\": \"contourcarpet\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}], \"contour\": [{\"type\": \"contour\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}, \"colorscale\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]]}], \"surface\": [{\"type\": \"surface\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}, \"colorscale\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]]}], \"mesh3d\": [{\"type\": \"mesh3d\", \"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}], \"scatter\": [{\"marker\": {\"line\": {\"color\": \"#283442\"}}, \"type\": \"scatter\"}], \"parcoords\": [{\"type\": \"parcoords\", \"line\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"scatterpolargl\": [{\"type\": \"scatterpolargl\", \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"bar\": [{\"error_x\": {\"color\": \"#f2f5fa\"}, \"error_y\": {\"color\": \"#f2f5fa\"}, \"marker\": {\"line\": {\"color\": \"rgb(17,17,17)\", \"width\": 0.5}, \"pattern\": {\"fillmode\": \"overlay\", \"size\": 10, \"solidity\": 0.2}}, \"type\": \"bar\"}], \"scattergeo\": [{\"type\": \"scattergeo\", \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"scatterpolar\": [{\"type\": \"scatterpolar\", \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"histogram\": [{\"marker\": {\"pattern\": {\"fillmode\": \"overlay\", \"size\": 10, \"solidity\": 0.2}}, \"type\": \"histogram\"}], \"scattergl\": [{\"marker\": {\"line\": {\"color\": \"#283442\"}}, \"type\": \"scattergl\"}], \"scatter3d\": [{\"type\": \"scatter3d\", \"line\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}, \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"scattermapbox\": [{\"type\": \"scattermapbox\", \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"scatterternary\": [{\"type\": \"scatterternary\", \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"scattercarpet\": [{\"type\": \"scattercarpet\", \"marker\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}}], \"carpet\": [{\"aaxis\": {\"endlinecolor\": \"#A2B1C6\", \"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"minorgridcolor\": \"#506784\", \"startlinecolor\": \"#A2B1C6\"}, \"baxis\": {\"endlinecolor\": \"#A2B1C6\", \"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"minorgridcolor\": \"#506784\", \"startlinecolor\": \"#A2B1C6\"}, \"type\": \"carpet\"}], \"table\": [{\"cells\": {\"fill\": {\"color\": \"#506784\"}, \"line\": {\"color\": \"rgb(17,17,17)\"}}, \"header\": {\"fill\": {\"color\": \"#2a3f5f\"}, \"line\": {\"color\": \"rgb(17,17,17)\"}}, \"type\": \"table\"}], \"barpolar\": [{\"marker\": {\"line\": {\"color\": \"rgb(17,17,17)\", \"width\": 0.5}, \"pattern\": {\"fillmode\": \"overlay\", \"size\": 10, \"solidity\": 0.2}}, \"type\": \"barpolar\"}], \"pie\": [{\"automargin\": true, \"type\": \"pie\"}]}, \"layout\": {\"autotypenumbers\": \"strict\", \"colorway\": [\"#636efa\", \"#EF553B\", \"#00cc96\", \"#ab63fa\", \"#FFA15A\", \"#19d3f3\", \"#FF6692\", \"#B6E880\", \"#FF97FF\", \"#FECB52\"], \"font\": {\"color\": \"#f2f5fa\"}, \"hovermode\": \"closest\", \"hoverlabel\": {\"align\": \"left\"}, \"paper_bgcolor\": \"rgb(17,17,17)\", \"plot_bgcolor\": \"rgb(17,17,17)\", \"polar\": {\"bgcolor\": \"rgb(17,17,17)\", \"angularaxis\": {\"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"ticks\": \"\"}, \"radialaxis\": {\"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"ticks\": \"\"}}, \"ternary\": {\"bgcolor\": \"rgb(17,17,17)\", \"aaxis\": {\"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"ticks\": \"\"}, \"baxis\": {\"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"ticks\": \"\"}, \"caxis\": {\"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"ticks\": \"\"}}, \"coloraxis\": {\"colorbar\": {\"outlinewidth\": 0, \"ticks\": \"\"}}, \"colorscale\": {\"sequential\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]], \"sequentialminus\": [[0.0, \"#0d0887\"], [0.1111111111111111, \"#46039f\"], [0.2222222222222222, \"#7201a8\"], [0.3333333333333333, \"#9c179e\"], [0.4444444444444444, \"#bd3786\"], [0.5555555555555556, \"#d8576b\"], [0.6666666666666666, \"#ed7953\"], [0.7777777777777778, \"#fb9f3a\"], [0.8888888888888888, \"#fdca26\"], [1.0, \"#f0f921\"]], \"diverging\": [[0, \"#8e0152\"], [0.1, \"#c51b7d\"], [0.2, \"#de77ae\"], [0.3, \"#f1b6da\"], [0.4, \"#fde0ef\"], [0.5, \"#f7f7f7\"], [0.6, \"#e6f5d0\"], [0.7, \"#b8e186\"], [0.8, \"#7fbc41\"], [0.9, \"#4d9221\"], [1, \"#276419\"]]}, \"xaxis\": {\"gridcolor\": \"#283442\", \"linecolor\": \"#506784\", \"ticks\": \"\", \"title\": {\"standoff\": 15}, \"zerolinecolor\": \"#283442\", \"automargin\": true, \"zerolinewidth\": 2}, \"yaxis\": {\"gridcolor\": \"#283442\", \"linecolor\": \"#506784\", \"ticks\": \"\", \"title\": {\"standoff\": 15}, \"zerolinecolor\": \"#283442\", \"automargin\": true, \"zerolinewidth\": 2}, \"scene\": {\"xaxis\": {\"backgroundcolor\": \"rgb(17,17,17)\", \"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"showbackground\": true, \"ticks\": \"\", \"zerolinecolor\": \"#C8D4E3\", \"gridwidth\": 2}, \"yaxis\": {\"backgroundcolor\": \"rgb(17,17,17)\", \"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"showbackground\": true, \"ticks\": \"\", \"zerolinecolor\": \"#C8D4E3\", \"gridwidth\": 2}, \"zaxis\": {\"backgroundcolor\": \"rgb(17,17,17)\", \"gridcolor\": \"#506784\", \"linecolor\": \"#506784\", \"showbackground\": true, \"ticks\": \"\", \"zerolinecolor\": \"#C8D4E3\", \"gridwidth\": 2}}, \"shapedefaults\": {\"line\": {\"color\": \"#f2f5fa\"}}, \"annotationdefaults\": {\"arrowcolor\": \"#f2f5fa\", \"arrowhead\": 0, \"arrowwidth\": 1}, \"geo\": {\"bgcolor\": \"rgb(17,17,17)\", \"landcolor\": \"rgb(17,17,17)\", \"subunitcolor\": \"#506784\", \"showland\": true, \"showlakes\": true, \"lakecolor\": \"rgb(17,17,17)\"}, \"title\": {\"x\": 0.05}, \"updatemenudefaults\": {\"bgcolor\": \"#506784\", \"borderwidth\": 0}, \"sliderdefaults\": {\"bgcolor\": \"#C8D4E3\", \"borderwidth\": 1, \"bordercolor\": \"rgb(17,17,17)\", \"tickwidth\": 0}, \"mapbox\": {\"style\": \"dark\"}}}";

pub(crate) async fn new_plot(div_id: &str, plot: &PlotlyPlot) {
    let PlotlyPlot {
        data,
        layout,
        config,
    } = plot;
    let data = JsValue::from_serde(data).expect("Failed to serialize data");
    let layout = JsValue::from_serde(layout).expect("Failed to serialize layout");
    // let config = JsValue::from_serde(config).expect("Failed to serialize config");
    let config: js_sys::Object = js_sys::JSON::parse("{}").unwrap().into();

    let template: js_sys::Object = js_sys::JSON::parse(TEMPLATE).unwrap().into();
    js_sys::Reflect::set(&layout, &"template".into(), &template).unwrap();
    js_sys::Reflect::set(&config, &"responsive".into(), &true.into()).unwrap();

    new_plot_(div_id, data.as_ref(), layout.as_ref(), config.as_ref())
        .await
        .expect("Failed to create new plot");

    let x = resize_(div_id).await.expect("Failed to resize plot");
    log::debug!("Resize result: {:?}", x);

    // log::debug!("Applying template {:?}", template);
    // restyle_(div_id, &template, &JsValue::UNDEFINED)
    //     .await
    //     .expect("Failed to apply template");
}

pub(crate) async fn update_plot(div_id: &str, plot: &PlotlyPlot) {
    let PlotlyPlot {
        data,
        layout,
        config,
    } = plot;
    let data = JsValue::from_serde(data).expect("Failed to serialize data");
    let layout = JsValue::from_serde(layout).expect("Failed to serialize layout");
    let config = JsValue::from_serde(config).expect("Failed to serialize config");
    log::debug!("Updating plot with layout: {:?}", layout);

    let data: js_sys::Object = js_sys::JSON::parse("{}").unwrap().into();

    // update_(div_id, data.as_ref(), layout.as_ref())
    //     .await
    //     .expect("Failed to update plot");
}

pub(crate) async fn relayout_plot(div_id: &str, layout: &JsValue) {
    log::debug!("Relayout plot with layout: {:?}", layout);
    relayout_(div_id, layout)
        .await
        .expect("Failed to relayout plot");
}

pub(crate) async fn resize_plot(div_id: &str) {
    let x = resize_(div_id).await.expect("Failed to resize plot");
    log::debug!("Resize result: {:?}", x);
}
