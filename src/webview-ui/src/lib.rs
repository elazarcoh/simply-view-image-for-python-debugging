mod app;
mod com_types;

use gloo_utils::format::JsValueSerdeExt;

use wasm_bindgen::prelude::*;
use web_sys::console;


#[wasm_bindgen]
pub fn send_example_to_js() -> JsValue {
    let example = com_types::Example {
        field3: [2., 3., 4., 5.],
    };

    JsValue::from_serde(&example).unwrap()
}

#[wasm_bindgen]
pub fn receive_example_from_js(_: JsValue) {
    // let example: com_types::Example = val.into_serde().unwrap();
}

#[wasm_bindgen()]
extern "C" {
    type WebviewApi;
    fn acquireVsCodeApi() -> WebviewApi;

    /**
     * Post a message to the owner of the webview.
     *
     * @param message Data to post. Must be JSON serializable.
     */
    #[wasm_bindgen(method)]
    fn postMessage(this: &WebviewApi, message: JsValue);
}

// When the `wee_alloc` feature is enabled, this uses `wee_alloc` as the global
// allocator.
//
// If you don't want to use `wee_alloc`, you can safely delete this.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Called by our JS entry point to run the example
#[wasm_bindgen(start)]
fn run() -> Result<(), JsValue> {
    // This provides better error messages in debug mode.
    // It's disabled in release mode so it doesn't bloat up the file size.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    let vscode = acquireVsCodeApi();

    // Use `web_sys`'s global `window` function to get a handle on the global
    // window object.
    let window = web_sys::window().expect("no global `window` exists");
    let document = window.document().expect("should have a document on window");
    let body = document.body().expect("document should have a body");

    // Manufacture the element we're gonna append
    let val = document.create_element("p")?;
    val.set_text_content(Some("Hello from Rust!"));

    body.append_child(&val)?;

    vscode.postMessage(send_example_to_js());
    // vscode.postMessage(JsValue::from_str(
    //     r#"{ "command": "hello", "payload": "Hey there partner! 🤠", "requestId": 1 }"#,
    // ));

    console::log_1(&"Hello using web-sys".into());

    app::render();

    Ok(())
}
