import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { logDebug, logError } from "../Logging";
import { isExpressionSelection } from "../utils/VSCodeUtils";
import { constructOpenSendAndCloseCode } from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { Except } from "../utils/Except";
import Container from "typedi";
import { SocketServer } from "../python-communication/socket-based/Server";
import { RequestsManager } from "../python-communication/socket-based/RequestsManager";
import { MessageChunkHeader } from "../python-communication/socket-based/protocol";

export async function serializePythonObjectUsingSocketServer(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession
): Promise<{ header: MessageChunkHeader; data: Buffer } | undefined> {
    const socketServer = Container.get(SocketServer);

    const objectAsString = isExpressionSelection(obj)
        ? obj.expression
        : obj.variable;

    const requestId = RequestsManager.randomRequestId();
    const code = constructOpenSendAndCloseCode(
        socketServer.portNumber,
        requestId,
        objectAsString
    );
    logDebug("Sending code to python: ", code);
    logDebug("Sending request to python with reqId ", requestId);
    const promise = new Promise<{ header: MessageChunkHeader; data: Buffer }>(
        (resolve) => {
            socketServer.onResponse(requestId, (header, data) => {
                logDebug("Received response from python with reqId ", requestId);
                resolve({ header, data });
            });
        }
    );
    const result = await evaluateInPython(code, session);

    const errorMessage = Except.isError(result)
        ? result.errorMessage
        : Except.isError(result.result)
        ? result.result.errorMessage
        : undefined;
    if (errorMessage !== undefined) {
        const message =
            `Error requesting viewable of type ${viewable.type}: ${errorMessage}`.replaceAll(
                "\\n",
                "\n"
            );
        logError(message);
        vscode.window.showErrorMessage(message);
        return Promise.resolve(undefined);
    } else {
        return promise;
    }
}
