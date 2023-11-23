import * as vscode from "vscode";
import { Viewable } from "../viewable/Viewable";
import { logDebug } from "../Logging";
import { isExpressionSelection, selectionString } from "../utils/VSCodeUtils";
import { constructOpenSendAndCloseCode } from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import Container from "typedi";
import { SocketServer } from "../python-communication/socket-based/Server";
import { RequestsManager } from "../python-communication/socket-based/RequestsManager";
import {
    ArrayDataType,
    MessageChunkHeader,
    ObjectType,
    datatypeToString,
    parseMessage,
} from "../python-communication/socket-based/protocol";
import { Datatype, ImageMessage } from "../webview/webview";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { Err, Ok, Result, errorMessage, joinResult } from "../utils/Result";

const SOCKET_PROTOCOL_DATATYPE_TO_WEBVIEW_DATATYPE: {
    [key in ArrayDataType]: Datatype | undefined;
} = {
    [ArrayDataType.Uint8]: "uint8",
    [ArrayDataType.Uint16]: "uint16",
    [ArrayDataType.Uint32]: "uint32",
    [ArrayDataType.Float32]: "float32",
    [ArrayDataType.Int8]: "int8",
    [ArrayDataType.Int16]: "int16",
    [ArrayDataType.Int32]: "int32",
    [ArrayDataType.Bool]: "bool",
    [ArrayDataType.Float64]: undefined,
    [ArrayDataType.Int64]: undefined,
    [ArrayDataType.Uint64]: undefined,
};

export async function serializePythonObjectUsingSocketServer(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession
): Promise<Result<{ header: MessageChunkHeader; data: Buffer }>> {
    const socketServer = Container.get(SocketServer);

    const objectAsString = selectionString(obj);

    const requestId = RequestsManager.randomRequestId();
    const code = constructOpenSendAndCloseCode(
        socketServer.portNumber,
        requestId,
        objectAsString
    );
    logDebug("Sending code to python: ", code);
    logDebug("Sending request to python with reqId ", requestId);
    const promise = new Promise<
        Result<{ header: MessageChunkHeader; data: Buffer }>
    >((resolve) => {
        socketServer.onResponse(requestId, (header, data) => {
            logDebug("Received response from python with reqId ", requestId);
            resolve(Ok({ header, data }));
        });
    });
    const result = joinResult(await evaluateInPython(code, session));

    if (result.err) {
        const message = `Error requesting viewable of type ${
            viewable.type
        }: ${errorMessage(result)}`.replaceAll("\\n", "\n");
        return Promise.resolve(Err(message));
    } else {
        return promise;
    }
}

function guessDimensions(shape: number[]): {
    height: number;
    width: number;
    channels: 1 | 2 | 3 | 4;
} {
    if (shape.length === 2) {
        return {
            height: shape[0],
            width: shape[1],
            channels: 1,
        };
    } else if (shape.length === 3) {
        return {
            height: shape[0],
            width: shape[1],
            channels: shape[2] as 1 | 2 | 3 | 4,
        };
    } else {
        return {
            height: 1,
            width: 1,
            channels: 1,
        };
    }
}

export async function serializeImageUsingSocketServer(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession
): Promise<Result<ImageMessage>> {
    const response = await serializePythonObjectUsingSocketServer(
        obj,
        viewable,
        session
    );
    if (response.err) {
        return Err("Error retrieving image using socket");
    } else {
        const expression = selectionString(obj);
        // parse response
        const { header, data } = response.safeUnwrap();
        const arrayOrError = parseMessage(header, data);
        if (arrayOrError.err) {
            return arrayOrError;
        }
        const object = arrayOrError.safeUnwrap();
        if (object.type !== ObjectType.NumpyArray) {
            const msg = `Expected array, got ${object.type}`;
            return Err(msg);
        }
        const arrayInfo = object.object;
        const len = arrayInfo.dimensions.reduce((a, b) => a * b, 1) * 4;
        const arrayBuffer = new ArrayBuffer(len);
        const arrayData = new Uint8Array(arrayBuffer);
        arrayData.set(arrayInfo.data);

        const debugSessionData = activeDebugSessionData(session);
        const infoOrError =
            debugSessionData.currentPythonObjectsList?.variablesList.find(
                ([exp]) => exp === selectionString(obj)
            )?.[1];

        let additionalInfo;
        if (infoOrError === undefined || infoOrError.err) {
            additionalInfo = {};
        } else {
            additionalInfo = infoOrError.safeUnwrap()[1];
        }

        const datatype =
            SOCKET_PROTOCOL_DATATYPE_TO_WEBVIEW_DATATYPE[arrayInfo.dataType];
        if (datatype === undefined) {
            const datatypeName = datatypeToString(arrayInfo.dataType);
            const msg = `Datatype ${datatypeName} not supported.`;
            return Err(msg);
        }

        const { height, width, channels } = guessDimensions(
            arrayInfo.dimensions
        );
        return Ok({
            image_id: expression,
            value_variable_kind: isExpressionSelection(obj)
                ? "expression"
                : "variable",
            expression: expression,
            width,
            height,
            channels,
            datatype,
            additional_info: additionalInfo,
            bytes: arrayBuffer,
        } as ImageMessage);
    }
}
