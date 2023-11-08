use wasm_bindgen::prelude::*;

#[wasm_bindgen()]
extern "C" {
    pub type WebviewApi;
    pub fn acquireVsCodeApi() -> WebviewApi;

    /**
     * Post a message to the owner of the webview.
     *
     * @param message Data to post. Must be JSON serializable.
     */
    #[wasm_bindgen(method)]
    pub fn postMessage(this: &WebviewApi, message: JsValue);
}