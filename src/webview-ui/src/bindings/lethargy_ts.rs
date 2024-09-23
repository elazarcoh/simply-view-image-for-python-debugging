use anyhow::{anyhow, Result};
use gloo_utils::format::JsValueSerdeExt;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// #[wasm_bindgen(typescript_custom_section)]
// const LETHARGY_CONFIG: &'static str = r#"
// interface LethargyConfig {
//   /** The minimum `wheelDelta` value for an event to be registered. Events with a `wheelDelta` below this value are ignored. */
//   sensitivity?: number;
//   /** If this time in milliseconds has passed since the last event, the current event is assumed to be user-triggered. */
//   delay?: number;
//   /** If `wheelDelta` has been increasing for this amount of consecutive events, the current event is assumed to be user-triggered. */
//   increasingDeltasThreshold?: number;
// }
// "#;

#[wasm_bindgen()]
extern "C" {
    #[wasm_bindgen(typescript_type = "LethargyConfig")]
    pub(crate) type _LethargyConfig;

    pub(crate) type Lethargy;

    #[wasm_bindgen(js_namespace = lethargy_ts, constructor)]
    pub(crate) fn new() -> Lethargy;

    #[wasm_bindgen(js_namespace = lethargy_ts, constructor)]
    pub(crate) fn new_with_options(config: _LethargyConfig) -> Lethargy;

    #[wasm_bindgen(method)]
    pub(crate) fn check(this: &Lethargy, e: &JsValue) -> bool;
}

#[derive(Debug, Builder, Serialize, Deserialize)]
#[builder(build_fn(name = "_build"))]
pub(crate) struct LethargyConfig {
    #[builder(default = "2")]
    sensitivity: u32,
    #[builder(default = "100")]
    delay: u32,
    #[serde(rename = "increasingDeltasThreshold")]
    #[builder(default = "3")]
    increasing_deltas_threshold: u32,
}

impl LethargyConfigBuilder {
    pub(crate) fn build(&self) -> Result<_LethargyConfig> {
        let config = self
            ._build()
            .map_err(|e| anyhow!("Failed to build LethargyConfig: {:?}", e))?;
        let opts = JsValue::from_serde(&config).unwrap();
        Ok(opts.unchecked_into())
    }
}
