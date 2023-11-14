#[cfg(debug_assertions)]
pub(crate) mod messages;
#[cfg(not(debug_assertions))]
mod messages;

mod parse_messages;
pub(crate) mod vscode_listener;
pub(crate) mod vscode_requests;

use wasm_bindgen::prelude::*;

#[wasm_bindgen()]
extern "C" {
    #[derive(Clone, Debug, PartialEq)]
    pub type WebviewApi;

    #[wasm_bindgen(js_name = "acquireVsCodeApi")]
    pub(crate) fn acquire_vscode_api() -> WebviewApi;

    /**
     * Post a message to the owner of the webview.
     *
     * @param message Data to post. Must be JSON serializable.
     */
    #[wasm_bindgen(method, js_name = "postMessage")]
    pub(crate) fn post_message(this: &WebviewApi, message: JsValue);
}
