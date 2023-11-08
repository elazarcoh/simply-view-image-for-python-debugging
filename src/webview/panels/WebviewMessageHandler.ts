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
import { FromExtensionMessage, FromExtensionMessageWithId, FromWebviewMessage, FromWebviewMessageWithId, ImageInfo, MessageId } from "../webview";
import { activeDebugSessionData } from "../../debugger-utils/DebugSessionsHolder";
import { hasValue } from "../../utils/Utils";

export class WebviewMessageHandler {
    constructor(private webview: Webview) {}

    handleImagesRequest(id: MessageId) {
        const validVariables: ImageInfo[] =
            activeDebugSessionData()?.currentPythonObjectsList?.variablesList.map(
                ([exp, info]) => (info.isError ? null : {
                    name: exp,
                    // shape: info.result[1]['shape'],
                    // data_type: info.result[1]['dtype'],
                } as ImageInfo)
            ).filter(hasValue) ?? [];
        const validExpressions: ImageInfo[] = []; // TODO: Implement this

        const message: FromExtensionMessage = {
            type: "ImageObjects",
            variables: validVariables,
            expressions: validExpressions,
        };
        this.sendToWebview({id, message});
    }

    async onWebviewMessage(message: FromWebviewMessageWithId) {
        console.log(message);

        // const path = "/home/elazar/simply-view-image-for-python-debugging/webgl_impl_reference/public/images/xray.png";
        // const contents = await fs.readFile(path, { encoding: 'base64' });
        // console.log(this.webview)
        // await this.sendToWebview({
        //         message: "Foo",
        //         imageBase64: contents,
        //     });

        const { id, message: {type, ...args} } = message;

        switch (type) {
            case "RequestImages":
                return this.handleImagesRequest(id);
            case "RequestImageData":
                //             window.showInformationMessage(payload);
                return;
            default:
                console.error(`Unknown message type: ${type}`);
        }
    }

    sendToWebview(message: FromExtensionMessageWithId) {
        return this.webview.postMessage(message);
    }

}
