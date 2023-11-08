import * as vscode from "vscode";
import { Service } from "typedi";
import { FromExtensionMessageWithId } from "../webview";

@Service()
export class WebviewClient {
    webview?: vscode.Webview;

    setWebview(webview: vscode.Webview) {
        this.webview = webview;
    }

    sendToWebview(message: FromExtensionMessageWithId) {
        return this.webview?.postMessage(message);
    }
}
