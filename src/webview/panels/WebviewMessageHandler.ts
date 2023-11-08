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
import { serializePythonObjectUsingSocketServer } from "../../from-python-serialization/SocketSerialization";
import { parseMessage } from "../../python-communication/socket-based/protocol";
import Container from "typedi";
import { WebviewClient } from "../communication/WebviewClient";

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

        const response = await serializePythonObjectUsingSocketServer(
            { expression: args.expression },
            objectViewables.result[0],
            debugSession
        );
        if (response !== undefined) {
            // parse response
            const { header, data } = response;
            const message = parseMessage(header, data);
            logDebug("Parsed message from client", message);
            if (Except.isError(message)) {
                throw new Error("Error parsing message from client");
            }
            const arrayInfo = message.result;
            const len = arrayInfo.dimensions.reduce((a, b) => a * b, 1) * 4;
            const arrayBuffer = new ArrayBuffer(len);
            const arrayData = new Uint8Array(arrayBuffer);
            arrayData.set(arrayInfo.data);

            // @ts-expect-error  // TODO: fix this
            const channels: 1 | 2 | 3 | 4 = arrayInfo.dimensions[2] ?? 1;
            const webviewClient = Container.get(WebviewClient);
            webviewClient.reveal();
            webviewClient.sendResponse(id, {
                type: "ImageData",
                width: arrayInfo.dimensions[1],
                height: arrayInfo.dimensions[0],
                channels,
                // TODO: variable or expression?
                value_variable_kind: "variable",
                image_id: args.image_id,
                expression: args.expression,
                datatype: "float32",
                bytes: arrayBuffer,
                additional_info: {},
            });
        }
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
