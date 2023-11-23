import { Err, Ok, Result, errorFromUnknown } from "../../utils/Result";
import { StatefulBufferReader } from "./BufferReader";
import { StatefulBufferWriter } from "./BufferWriter";

/**
Protocol
--------

Every message should have the following format:
   Total Length of the message (4 bytes)
   Message ID (4 bytes)
   Sender (1 byte)
   Request ID (4 bytes)
   Message type (1 byte)
   Chunk count (4 bytes)
   Chunk number (4 bytes)
   Chunk length (4 bytes)
   Chunk data (variable length)


Hello message:
    (no content)

Request Python object message:
    Python expression (variable length)

*/

export type RequestId = number;
export type MessageId = number;

export type MessageChunkHeader = {
    messageLength: number;
    messageID: MessageId;
    sender: Sender;
    requestId: RequestId;
    messageType: MessageType;
    chunkCount: number;
    chunkNumber: number;
    chunkLength: number;
};

const BytesPerKey = {
    messageLength: 4,
    messageID: 4,
    sender: 1,
    requestId: 4,
    messageType: 1,
    chunkCount: 4,
    chunkNumber: 4,
    chunkLength: 4,
} as { [key in keyof MessageChunkHeader]: number };

export const HEADER_LENGTH = Object.entries(BytesPerKey).reduce(
    (acc, [_, value]) => acc + value,
    0
);

export enum Sender {
    Server = 0x01,
    Python = 0x02,
}

export enum MessageType {
    PythonSendingObject = 0x01,
}

export enum ObjectType {
    NumpyArray = 0x01,
    Exception = 0xff,
}
enum ByteOrder {
    LittleEndian = 0x01,
    BigEndian = 0x02,
}
export enum ArrayDataType {
    Float32 = 0x01,
    Float64 = 0x02,
    Int8 = 0x03,
    Int16 = 0x04,
    Int32 = 0x05,
    Int64 = 0x06,
    Uint8 = 0x07,
    Uint16 = 0x08,
    Uint32 = 0x09,
    Uint64 = 0x0a,
    Bool = 0x0b,
}

export function datatypeToString(datatype: ArrayDataType) {
    switch (datatype) {
        case ArrayDataType.Float32:
            return "float32";
        case ArrayDataType.Float64:
            return "float64";
        case ArrayDataType.Int8:
            return "int8";
        case ArrayDataType.Int16:
            return "int16";
        case ArrayDataType.Int32:
            return "int32";
        case ArrayDataType.Int64:
            return "int64";
        case ArrayDataType.Uint8:
            return "uint8";
        case ArrayDataType.Uint16:
            return "uint16";
        case ArrayDataType.Uint32:
            return "uint32";
        case ArrayDataType.Uint64:
            return "uint64";
        case ArrayDataType.Bool:
            return "bool";
    }
}

export function splitHeaderContentRest(
    buffer: Buffer
): Result<[MessageChunkHeader, Buffer, Buffer]> {
    if (buffer.length < HEADER_LENGTH) {
        return Err(
            `Buffer shorter than header length: ${buffer.length} < ${HEADER_LENGTH}`
        );
    }
    const reader = new StatefulBufferReader(buffer);
    const messageLength = reader.readUInt32();
    const messageID = reader.readUInt32();
    const sender = reader.readUInt8();
    const requestId = reader.readUInt32();
    const messageType = reader.readUInt8();
    const chunkCount = reader.readUInt32();
    const chunkNumber = reader.readUInt32();
    const chunkLength = reader.readUInt32();
    const header: MessageChunkHeader = {
        messageLength,
        messageID,
        sender,
        requestId,
        messageType,
        chunkCount,
        chunkNumber,
        chunkLength,
    };
    const data = buffer.subarray(HEADER_LENGTH);
    if (data.length < chunkLength) {
        return Err(
            `Buffer shorter than chunk length: ${data.length} < ${chunkLength}`
        );
    } else if (data.length > chunkLength) {
        const rest = data.subarray(chunkLength);
        return Ok([header, data.subarray(0, chunkLength), rest]);
    } else {
        return Ok([header, data, Buffer.alloc(0)]);
    }
}

export function randomMessageId() {
    return Math.floor(Math.random() * 2 ** 32);
}

export function composeHelloMessage(requestId: RequestId, sender: Sender) {
    const messageLength = HEADER_LENGTH;
    const messageID = randomMessageId();
    const messageType = MessageType.PythonSendingObject;
    const chunkCount = 1;
    const chunkNumber = 0;
    const chunkLength = 0;

    const buffer = Buffer.alloc(messageLength);
    const writer = new StatefulBufferWriter(buffer);
    writer.writeUInt32(messageLength);
    writer.writeUInt32(messageID);
    writer.writeUInt8(sender);
    writer.writeUInt32(requestId);
    writer.writeUInt8(messageType);
    writer.writeUInt32(chunkCount);
    writer.writeUInt32(chunkNumber);
    writer.writeUInt32(chunkLength);
    return buffer;
}

type ArrayInfo = {
    dataType: ArrayDataType;
    byteOrder: ByteOrder;
    dimensions: number[];
    data: Buffer;
};
function parseNumpyArrayMessage(buffer: Buffer): Result<ArrayInfo> {
    try {
        const reader = new StatefulBufferReader(buffer);
        const dataType = reader.readUInt8();
        const byteOrder = reader.readUInt8();
        const numberOfDimensions = reader.readUInt8();
        const dimensions = [];
        for (let i = 0; i < numberOfDimensions; i++) {
            dimensions.push(reader.readUInt32());
        }
        const data = reader.currentBuffer;
        return Ok({
            dataType,
            byteOrder,
            dimensions,
            data,
        });
    } catch (e) {
        return errorFromUnknown(e);
    }
}

type ExceptionInfo = {
    type: string;
    message: string;
};
function parseExceptionMessage(buffer: Buffer): Result<ExceptionInfo> {
    try {
        const reader = new StatefulBufferReader(buffer);
        const type = reader.readString();
        const message = reader.readString();
        return Ok({
            type,
            message,
        });
    } catch (e) {
        return errorFromUnknown(e);
    }
}

type PythonObject =
    | { type: ObjectType.NumpyArray; object: ArrayInfo }
    | { type: ObjectType.Exception; object: ExceptionInfo };

function parsePythonSendingObjectMessage(buffer: Buffer): Result<PythonObject> {
    const reader = new StatefulBufferReader(buffer);
    const objectType = reader.readUInt8();
    switch (objectType) {
        case ObjectType.NumpyArray:
            return parseNumpyArrayMessage(reader.currentBuffer).map((v) => ({
                type: objectType,
                object: v,
            }));
        case ObjectType.Exception:
            return parseExceptionMessage(reader.currentBuffer).map((v) => ({
                type: objectType,
                object: v,
            }));
        default:
            throw new Error("Unknown object type: " + objectType);
    }
}

export function parseMessage(header: MessageChunkHeader, data: Buffer) {
    const { messageType } = header;
    switch (messageType) {
        case MessageType.PythonSendingObject:
            return parsePythonSendingObjectMessage(data);
        default:
            throw new Error(`Unknown message type ${messageType}`);
    }
}