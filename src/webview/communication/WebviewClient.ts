import * as vscode from "vscode";
import { Service } from "typedi";
import {
    ExtensionRequest,
    ExtensionResponse,
    FromExtensionMessageWithId,
    MessageId,
} from "../webview";
import { ImageViewPanel } from "../panels/ImageViewPanel";
import { logTrace } from "../../Logging";

@Service()
export class WebviewClient {
    webview?: vscode.Webview;
    isReady = false;

    constructor(private readonly context: vscode.ExtensionContext) {}

    static randomMessageId(): MessageId {
        return Math.random().toString(36).substring(2, 15);
    }

    setWebview(webview: vscode.Webview) {
        this.webview = webview;
    }
    setReady() {
        this.isReady = true;
    }

    unsetWebview() {
        this.webview = undefined;
        this.isReady = false;
    }

    async reveal() {
        ImageViewPanel.render(this.context);
        // wait for the webview to be ready
        let maxTries = 100;
        while (!this.isReady && maxTries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            maxTries--;
        }
    }

    private sendToWebview(message: FromExtensionMessageWithId) {
        if (this.webview === undefined) {
            return;
        }
        logTrace(`message: ${JSON.stringify(message)}`);
        return this.webview.postMessage(message);
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
