import * as vscode from "vscode";
import {
    FromWebviewMessageWithId,
    ImageInfo,
    MessageId,
    RequestImageData,
} from "../webview";
import { findExpressionViewables } from "../../PythonObjectInfo";
import { Except } from "../../utils/Except";
import { serializePythonObjectToDisk } from "../../from-python-serialization/DiskSerialization";
import { logDebug } from "../../Logging";

export class WebviewMessageHandler {

    handleImagesRequest(_id: MessageId) {
        // const validVariables: ImageInfo[] =
        //     activeDebugSessionData()
        //         ?.currentPythonObjectsList?.variablesList.map(([exp, info]) =>
        //             info.isError
        //                 ? null
        //                 : ({
        //                       name: exp,
        //                       // shape: info.result[1]['shape'],
        //                       // data_type: info.result[1]['dtype'],
        //                   } as ImageInfo)
        //         )
        //         .filter(hasValue) ?? [];
        // const validExpressions: ImageInfo[] = []; // TODO: Implement this
        // const message: FromExtensionMessage = {
        //     type: "ImageObjects",
        //     variables: validVariables,
        //     expressions: validExpressions,
        // };
        // this.sendToWebview({ id, message });
    }

    async handleImageDataRequest(id: MessageId, args: RequestImageData) {
        const debugSession = vscode.debug.activeDebugSession;
        if (debugSession === undefined) {
            return undefined;
        }

        const objectViewables = await findExpressionViewables(
            args.expression,
            debugSession
        );

        if (
            Except.isError(objectViewables) ||
            objectViewables.result.length === 0
        ) {
            return undefined;
        }

        // TODO: currently using disk-serialization. should improve this (socket?). Anyway, need to be configurable.
        const path = await serializePythonObjectToDisk(
            { expression: args.expression },
            objectViewables.result[0],
            debugSession
        );
        if (path === undefined) {
            return undefined;
        }

        // load image from disk
        // const contents = await fs.readFile(path, { encoding: "base64" });
        // await this.sendToWebview({
        //     id,
        //     message: {
        //         type: "ImageData",
        //         image_id: args.image_id,
        //         base64: contents,
        //     },
        // });
    }

    async handleWebviewReady(id: MessageId) {
        logDebug("Webview ready");

        const image_info: ImageInfo = {
            image_id: "foobar-id",
            value_variable_kind: "variable",
            expression: "img[:2, :2]",
            width: 512,
            height: 512,
            channels: 3,
            datatype: "uint8",
            additional_info: {},
        };
        // const websocketServer = Container.get(WebsocketServer);
        // const port = websocketServer.port;
        // const data = Uint8Array.from([1, 2, 3, 4, 5]);
        const len = image_info.width * image_info.height * image_info.channels;
        const arrayBuffer = new ArrayBuffer(len);
        const data = new Uint8Array(arrayBuffer);
        for (let i = 0; i < len; ++i) {
            data[i] = i % 16;
        }
        // const data = Buffer.alloc(1024 * 1024 * 10).fill(3);
        // const message: FromExtensionMessage = {
        //     type: "WebsocketServerInfo",
        //     // @ts-expect-error // TODO: fix this
        //     data,
        // };
        // this.sendToWebview({ id, message });
        // return this.sendToWebview({
        //     id,
        //     message: { type: "ImageData", ...image_info, bytes: arrayBuffer },
        // });
    }

    async onWebviewMessage(message_with_id: FromWebviewMessageWithId) {
        console.log(message_with_id);

        const { id, message } = message_with_id;

        const type = message.type;
        switch (type) {
            case "WebviewReady":
                return this.handleWebviewReady(id);
            case "RequestImages":
                return this.handleImagesRequest(id);
            case "RequestImageData":
                return this.handleImageDataRequest(id, message);

            default:
                ((_: never) => {
                    throw new Error(`Unknown message type: ${type}`);
                })(type);
        }
    }
}
