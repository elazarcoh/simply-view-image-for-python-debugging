import {
    Disposable,
    Webview,
    WebviewPanel,
    window,
    Uri,
    ViewColumn,
} from "vscode";
// import { PostWebviewMessage } from "../webview";
import * as fs from "fs/promises";

interface PostWebviewMessage { }

export class WebviewMessageHandler {

    constructor(private webview: Webview) { }

    sendToWebview(message: PostWebviewMessage) {
        return this.webview.postMessage(message)
    }

    async onWebviewMessage(message: any) {
        console.log(message);

        const path = "C:/Users/hodaya/Documents/simply-view-image-for-python-debugging/watch-view.png";
        const contents = await fs.readFile(path, { encoding: 'base64' });
        console.log(this.webview)
        await this.sendToWebview({
                message: "Foo",
                imageBase64: contents,
            });

    //     message = JSON.parse(message);

    //     const { command, requestId, payload } = message;

    //     // Do something with the payload
    //     console.log(payload);

    //     switch (command) {
    //         case "hello":
    //             window.showInformationMessage(payload);
    //             return;
    //         default:
    //             // Send a response back to the webview
    //             return this.webview.postMessage({
    //                 command,
    //                 requestId, // The requestId is used to identify the response
    //                 payload: `Hello from the extension!`,
    //             });
        // }
    }
}