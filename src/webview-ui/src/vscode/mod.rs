use wasm_bindgen::prelude::*;

#[wasm_bindgen()]
extern "C" {
    #[derive(Clone, Debug, PartialEq)]
    pub type WebviewApi;

    #[wasm_bindgen(js_name = "acquireVsCodeApi")]
    pub fn acquire_vscode_api() -> WebviewApi;

    /**
     * Post a message to the owner of the webview.
     *
     * @param message Data to post. Must be JSON serializable.
     */
    #[wasm_bindgen(method, js_name = "postMessage")]
    pub fn post_message(this: &WebviewApi, message: JsValue);
}