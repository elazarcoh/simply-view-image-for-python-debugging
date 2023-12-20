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
    MessageChunkHeader,
    ObjectType,
    parseMessage,
} from "../python-communication/socket-based/protocol";
import {
    Datatype as WebviewDatatype,
    DataOrdering as WebviewDataOrdering,
    ImageMessage,
} from "../webview/webview";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { Err, Ok, Result, errorMessage, joinResult } from "../utils/Result";
import { ArrayDataType, DimensionOrder } from "../common/datatype";

const SOCKET_PROTOCOL_DATATYPE_TO_WEBVIEW_DATATYPE: {
    [key in ArrayDataType]: WebviewDatatype | undefined;
} = {
    [ArrayDataType.UInt8]: "uint8",
    [ArrayDataType.UInt16]: "uint16",
    [ArrayDataType.UInt32]: "uint32",
    [ArrayDataType.Float32]: "float32",
    [ArrayDataType.Int8]: "int8",
    [ArrayDataType.Int16]: "int16",
    [ArrayDataType.Int32]: "int32",
    [ArrayDataType.Bool]: "bool",
    [ArrayDataType.Float64]: undefined,
    [ArrayDataType.Int64]: undefined,
    [ArrayDataType.UInt64]: undefined,
};

const SOCKET_PROTOCOL_ORDERING_TO_WEBVIEW_ORDERING: {
    [key in DimensionOrder]: WebviewDataOrdering | undefined;
} = {
    [DimensionOrder.HWC]: "hwc",
    [DimensionOrder.CHW]: "chw",
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
        if (object.type === ObjectType.Exception) {
            const msg = `Exception: ${object.object.type}: ${object.object.message}`;
            return Err(msg);
        }
        if (object.type !== ObjectType.NumpyArray) {
            // @ts-expect-error. Currently, we have only two types. Left here for future.
            const msg = `Expected array, got ${object.type}`;
            return Err(msg);
        }
        const arrayInfo = object.object;

        const arrayDataType = arrayInfo.actualDataType ?? arrayInfo.dataType;
        const webviewDatatype =
            SOCKET_PROTOCOL_DATATYPE_TO_WEBVIEW_DATATYPE[arrayDataType];
        if (webviewDatatype === undefined) {
            const msg = `Datatype ${arrayDataType} not supported.`;
            return Err(msg);
        }

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

        const dataOrdering =
            SOCKET_PROTOCOL_ORDERING_TO_WEBVIEW_ORDERING[
                arrayInfo.dimensionOrder
            ];
        if (dataOrdering === undefined) {
            const msg = `Data ordering ${arrayInfo.dimensionOrder} not supported.`;
            return Err(msg);
        }

        const image_message: ImageMessage = {
            image_id: expression,
            value_variable_kind: isExpressionSelection(obj)
                ? "expression"
                : "variable",
            expression: expression,
            width: arrayInfo.width,
            height: arrayInfo.height,
            channels: arrayInfo.channels as 1 | 2 | 3 | 4,
            datatype: webviewDatatype,
            additional_info: additionalInfo,
            min: arrayInfo.mins,
            max: arrayInfo.maxs,
            data_ordering: arrayInfo.dimensionOrder,
            bytes: arrayBuffer,
        };
        return Ok(image_message);
    }
}
