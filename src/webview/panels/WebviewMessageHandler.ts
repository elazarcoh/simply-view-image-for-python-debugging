import * as vscode from "vscode";
import {
    FromWebviewMessageWithId,
    MessageId,
    RequestImageData,
} from "../webview";
import { findExpressionViewables } from "../../PythonObjectInfo";
import { Except } from "../../utils/Except";
import { logError, logTrace } from "../../Logging";
import { serializeImageUsingSocketServer } from "../../from-python-serialization/SocketSerialization";
import Container from "typedi";
import { WebviewClient } from "../communication/WebviewClient";
import { WebviewResponses } from "../communication/createMessages";

export class WebviewMessageHandler {
    readonly client = Container.get(WebviewClient);

    handleImagesRequest(id: MessageId) {
        this.client.sendResponse(id, WebviewResponses.imagesObjects());
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

        const response = await serializeImageUsingSocketServer(
            { expression: args.expression },
            objectViewables.result[0],
            debugSession
        );
        if (Except.isError(response)) {
            logError(
                "Error retrieving image using socket",
                response.errorMessage
            );
            return undefined;
        }

        this.client.sendResponse(
            id,
            WebviewResponses.imageData(response.result)
        );
    }

    async handleWebviewReady(id: MessageId) {
        this.client.sendResponse(id, WebviewResponses.imagesObjects());
    }

    async onWebviewMessage(messageWithId: FromWebviewMessageWithId) {
        logTrace("Received message from webview", messageWithId);

        const { id, message } = messageWithId;

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
