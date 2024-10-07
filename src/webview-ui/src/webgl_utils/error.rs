use std::convert::TryFrom;

use js_sys::JSON;
use strum_macros::Display;
use thiserror::Error;
use wasm_bindgen::{JsCast, JsValue};
use web_sys::WebGl2RenderingContext;

use super::WebGlErrorCode;

#[derive(Error, Debug, Display)]
#[allow(dead_code)]
pub(crate) enum WebGlError {
    UnknownConstant(u32, &'static str),
    #[allow(clippy::enum_variant_names)]
    WebGlError {
        code: WebGlErrorCode,
        context: String,
    },
    Unknown(String),
    JsError {
        // NOTE: We can't store the original error because it's not Send.
        // js_error: Option<js_sys::Error>,
        // original_value: JsValue,
        string_repr: String,
        context: String,
    },
}

impl WebGlError {
    pub(crate) fn last_webgl_error(gl: &WebGl2RenderingContext, context: &str) -> Option<Self> {
        let code = WebGlErrorCode::try_from(gl.get_error())
            .map_err(|msg| format!("Error while converting WebGl error code: {}", msg))
            .unwrap();

        Some(Self::WebGlError {
            code,
            context: context.to_string(),
        })
    }

    pub(crate) fn last_webgl_error_or_unknown(gl: &WebGl2RenderingContext, context: &str) -> Self {
        Self::last_webgl_error(gl, context).unwrap_or_else(|| Self::Unknown(context.into()))
    }

    pub(crate) fn from_js_value(js_value: &JsValue, context: &str) -> Self {
        let js_string = js_value
            .dyn_ref::<js_sys::Error>()
            .map(|e| e.to_string())
            .unwrap_or_else(|| JSON::stringify(js_value).unwrap());
        let string_repr = js_string
            .as_string()
            .unwrap_or("Could not convert error to string".into());
        Self::JsError {
            // js_error: js_value.dyn_ref::<js_sys::Error>().cloned(),
            // original_value: js_value.clone(),
            string_repr,
            context: context.to_string(),
        }
    }
}
