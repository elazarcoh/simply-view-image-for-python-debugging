use crate::vscode::WebviewApi;

struct MessageHandler {
    vscode_webview_api: WebviewApi
}

impl MessageHandler {
    pub fn new(vscode_webview_api: WebviewApi) -> Self {
        Self {
            vscode_webview_api
        }
    }
}