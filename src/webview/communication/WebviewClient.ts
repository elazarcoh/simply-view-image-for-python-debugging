import * as vscode from "vscode";
import { Service } from "typedi";
import {
    ExtensionRequest,
    ExtensionResponse,
    FromExtensionMessageWithId,
    MessageId,
} from "../webview";
import { ImageViewPanel } from "../panels/ImageViewPanel";

@Service()
export class WebviewClient {
    webview?: vscode.Webview;

    constructor(private readonly context: vscode.ExtensionContext) {}

    static randomMessageId(): MessageId {
        return Math.random().toString(36).substring(2, 15);
    }

    setWebview(webview: vscode.Webview) {
        this.webview = webview;
    }

    reveal() {
        ImageViewPanel.render(this.context);
    }

    private sendToWebview(message: FromExtensionMessageWithId) {
        return this.webview?.postMessage(message);
    }

    sendRequest(message: ExtensionRequest) {
        const id = WebviewClient.randomMessageId();
        const messageWithId: FromExtensionMessageWithId = {
            id,
            message: { kind: "Request", ...message },
        };
        this.sendToWebview(messageWithId);
    }

    sendResponse(id: MessageId, message: ExtensionResponse) {
        const messageWithId: FromExtensionMessageWithId = {
            id,
            message: { kind: "Response", ...message },
        };
        this.sendToWebview(messageWithId);
    }
}
