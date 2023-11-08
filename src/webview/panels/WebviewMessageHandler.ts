import {
    Disposable,
    Webview,
    WebviewPanel,
    window,
    Uri,
    ViewColumn,
} from "vscode";
import { PostWebviewMessage } from "../webview";

export class WebviewMessageHandler {

    constructor(private webview: Webview) { }

    sendToWebview(message: PostWebviewMessage) {
        this.webview.postMessage(message)
    }

    onWebviewMessage(message: any) {
        console.log(message);
        message = JSON.parse(message);

        const { command, requestId, payload } = message;

        // Do something with the payload
        console.log(payload);

        switch (command) {
            case "hello":
                window.showInformationMessage(payload);
                return;
            default:
                // Send a response back to the webview
                return this.webview.postMessage({
                    command,
                    requestId, // The requestId is used to identify the response
                    payload: `Hello from the extension!`,
                });
        }
    }
}