use std::ops::Deref;

use wasm_bindgen::{convert::FromWasmAbi, prelude::*};

use gloo_utils::format::JsValueSerdeExt;
use serde::{Deserialize, Serialize};

#[wasm_bindgen()]
extern "C" {
    #[wasm_bindgen(extends = js_sys::Function)]
    type _Debounced;

    #[wasm_bindgen(js_namespace = _, js_name = debounce)]
    fn _debounce(func: &JsValue, wait: u32, opts: js_sys::Object) -> _Debounced;

    #[wasm_bindgen(structural, method)]
    fn cancel(this: &_Debounced);

    #[wasm_bindgen(structural, method)]
    fn flush(this: &_Debounced);
}

#[derive(Debug, Builder, Serialize, Deserialize)]
pub(crate) struct DebouncedOptions {
    #[builder(default = "false")]
    leading: bool,
    #[serde(rename = "maxWait")]
    #[builder(default = "0")]
    max_wait: u32,
    #[builder(default = "true")]
    trailing: bool,
}

impl Default for DebouncedOptions {
    fn default() -> Self {
        Self {
            leading: false,
            max_wait: 0,
            trailing: true,
        }
    }
}

pub(crate) struct Debounced {
    debounced: _Debounced,
    inner: JsValue,
}

pub(crate) fn debounce_closure<T>(
    func: Closure<dyn Fn(T)>,
    wait: u32,
    opts: DebouncedOptions,
) -> Debounced
where
    T: Into<JsValue> + FromWasmAbi + 'static, // This is probably not correct to use static lifetime here
{
    let opts = JsValue::from_serde(&opts).unwrap();
    let inner = func.into_js_value();
    let debounced = _debounce(&inner, wait, opts.into());
    Debounced { debounced, inner }
}

pub(crate) fn debounce_closure_mutable(
    func: Closure<dyn FnMut(JsValue)>,
    wait: u32,
    opts: DebouncedOptions,
) -> Debounced {
    let opts = JsValue::from_serde(&opts).unwrap();
    let inner = func.into_js_value();
    let debounced = _debounce(&inner, wait, opts.into());
    Debounced { debounced, inner }
}

impl Debounced {
    pub(crate) fn cancel(&self) {
        self.debounced.cancel();
    }

    pub(crate) fn flush(&self) {
        self.debounced.flush();
    }

    pub(crate) fn drop(self) {
        self.cancel();
    }
}

impl Deref for Debounced {
    type Target = js_sys::Function;

    fn deref(&self) -> &Self::Target {
        self.debounced.as_ref()
    }
}
