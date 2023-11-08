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
    Webview = 0x03,
}

export enum MessageType {
    Hello = 0x01,
    RequestPythonObject = 0x02,
}

export function splitHeaderContentRest(
    buffer: Buffer
): [MessageChunkHeader, Buffer, Buffer] | undefined {
    if (buffer.length < HEADER_LENGTH) {
        return undefined;
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
        return undefined;
    } else if (data.length > chunkLength) {
        const rest = data.subarray(chunkLength);
        return [header, data.subarray(0, chunkLength), rest];
    } else {
        return [header, data, Buffer.alloc(0)];
    }
}

export function randomMessageId() {
    return Math.floor(Math.random() * 2 ** 32);
}

export function composeHelloMessage(requestId: RequestId, sender: Sender) {
    const messageLength = HEADER_LENGTH;
    const messageID = randomMessageId();
    const messageType = MessageType.Hello;
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

function parseRequestPythonObjectMessage(
    header: MessageChunkHeader,
    data: Buffer
) {
    const str = data.toString("utf-8");
    return str;
}

export function parseMessage(header: MessageChunkHeader, data: Buffer) {
    const { messageType } = header;
    switch (messageType) {
        case MessageType.Hello:
            return;
        case MessageType.RequestPythonObject:
            return parseRequestPythonObjectMessage(header, data);
        default:
            throw new Error(`Unknown message type ${messageType}`);
    }
}
