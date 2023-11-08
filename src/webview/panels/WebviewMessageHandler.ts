import * as vscode from "vscode";
import * as fs from "fs/promises";
import {
    FromExtensionMessage,
    FromExtensionMessageWithId,
    FromWebviewMessageWithId,
    ImageInfo,
    MessageId,
    RequestImageData,
} from "../webview";
import { activeDebugSessionData } from "../../debugger-utils/DebugSessionsHolder";
import { hasValue } from "../../utils/Utils";
import { findExpressionViewables } from "../../PythonObjectInfo";
import { Except } from "../../utils/Except";
import { serializePythonObjectToDisk } from "../../from-python-serialization/DiskSerialization";

export class WebviewMessageHandler {
    constructor(private webview: vscode.Webview) {}

    handleImagesRequest(id: MessageId) {
        const validVariables: ImageInfo[] =
            activeDebugSessionData()
                ?.currentPythonObjectsList?.variablesList.map(([exp, info]) =>
                    info.isError
                        ? null
                        : ({
                              name: exp,
                              // shape: info.result[1]['shape'],
                              // data_type: info.result[1]['dtype'],
                          } as ImageInfo)
                )
                .filter(hasValue) ?? [];
        const validExpressions: ImageInfo[] = []; // TODO: Implement this

        const message: FromExtensionMessage = {
            type: "ImageObjects",
            variables: validVariables,
            expressions: validExpressions,
        };
        this.sendToWebview({ id, message });
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
        const contents = await fs.readFile(path, { encoding: "base64" });
        await this.sendToWebview({
            id,
            message: {
                type: "ImageData",
                image_id: args.image_id,
                base64: contents,
            },
        });
    }

    async onWebviewMessage(message_with_id: FromWebviewMessageWithId) {
        console.log(message_with_id);

        const { id, message } = message_with_id;

        const type = message.type;
        switch (type) {
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

    sendToWebview(message: FromExtensionMessageWithId) {
        return this.webview.postMessage(message);
    }
}
