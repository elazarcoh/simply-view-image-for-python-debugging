import { Service } from "typedi";
import * as net from "net";
// import { logDebug, logInfo } from "../Logging";

// Message format:
// 1. Message length (4 bytes)
// 2. Message type (1 byte)
// 3. Message data (length bytes)
//
// Message types:
// 1. Python sending an object => 0x01
//    Message data format:
//    Request ID (4 bytes)
//    Object ID (4 bytes)
//    Object type (1 byte)
//    Object data (length bytes)
//
//    Object types:
//    1. numpy array => 0x01
//       Object data format:
//       Data type (1 byte)
//       Byte order of the array data (1 byte)
//       Number of dimensions (1 byte)
//       Dimensions (4 bytes each)
//       Padding (0-7 bytes)
//       Data (length bytes)
//
//       Data types:
//       1. float32 => 0x01
//       2. float64 => 0x02
//       3. int8 => 0x03
//       4. int16 => 0x04
//       5. int32 => 0x05
//       6. int64 => 0x06
//       7. uint8 => 0x07
//       8. uint16 => 0x08
//       9. uint32 => 0x09
//       10. uint64 => 0x0a
//       11. bool => 0x0b
//
//     2. Json => 0x02
//        Object data format:
//        Json string (length bytes)
//
//    -1. Exception => 0xff
//        Object data format:
//        Exception type (1 byte)
//        Exception message (length bytes)
//
// 2. Webview Hello => 0x02
//    Message data format:
//    None

enum MessageType {
    PythonSendingObject = 0x01,
    WebviewHello = 0x02,
}
export enum ObjectType {
    NumpyArray = 0x01,
    Json = 0x02,
    Exception = 0xff,
}
enum ByteOrder {
    LittleEndian = 0x01,
    BigEndian = 0x02,
}
enum ArrayDataType {
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
enum ExceptionType {
    // Common exceptions in Python
    BaseException = 0x01,
    Exception = 0x02,
    RuntimeError = 0x03,
    TypeError = 0x04,
    ValueError = 0x05,
    UnknownException = 0xff,
}

class StatefulReader {
    readonly functions: {
        [key: string]: [number, (offset?: number) => number];
    } = {
        readUInt8: [1, Buffer.prototype.readUInt8],
        readUInt32: [4, Buffer.prototype.readUInt32BE],
        readFloat32: [4, Buffer.prototype.readFloatBE],
        readFloat64: [8, Buffer.prototype.readDoubleBE],
    };

    constructor(private buffer: Buffer) {}

    get currentBuffer() {
        return this.buffer;
    }

    private read([length, readFunction]: [
        number,
        (offset?: number) => number
    ]) {
        const result = readFunction.call(this.buffer, 0);
        const newBuffer = this.buffer.subarray(length);
        this.buffer = newBuffer;
        return result;
    }

    readUInt8() {
        return this.read(this.functions.readUInt8);
    }
    readUInt32() {
        return this.read(this.functions.readUInt32);
    }
    readFloat32() {
        return this.read(this.functions.readFloat32);
    }
    readFloat64() {
        return this.read(this.functions.readFloat64);
    }
}

type WebviewHelloMessage = { type: MessageType.WebviewHello };
type PythonSendingObjectMessage<T> = {
    type: MessageType.PythonSendingObject;
    requestId: number;
    objectId: number;
    objectType: ObjectType;
    object: T;
};
type Message = PythonSendingObjectMessage<unknown> | WebviewHelloMessage;

function parseMessage(messageType: MessageType, buffer: Buffer): Message {
    const reader = new StatefulReader(buffer);
    switch (messageType) {
        case MessageType.PythonSendingObject:
            return parsePythonSendingObjectMessage(reader.currentBuffer);
        case MessageType.WebviewHello:
            return { type: MessageType.WebviewHello };
        default:
            throw new Error("Unknown message type: " + messageType);
    }
}

function parsePythonSendingObjectMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const requestId = reader.readUInt32();
    logDebug("Request ID (ui32): ", requestId, "; ", reader.currentBuffer);
    const objectId = reader.readUInt32();
    logDebug("Object ID (ui32): ", objectId, "; ", reader.currentBuffer);
    const objectType = reader.readUInt8();
    logDebug("Object type (ui8): ", objectType, "; ", reader.currentBuffer);
    let obj;
    switch (objectType) {
        case ObjectType.NumpyArray:
            obj = parseNumpyArrayMessage(reader.currentBuffer);
            break;
        case ObjectType.Json:
            obj = parseJsonMessage(reader.currentBuffer);
            break;
        case ObjectType.Exception:
            obj = parseExceptionMessage(reader.currentBuffer);
            break;
        default:
            throw new Error("Unknown object type: " + objectType);
    }

    return {
        type: MessageType.PythonSendingObject,
        requestId,
        objectId,
        objectType,
        object: obj,
    };
}

function parseJsonMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const json = reader.currentBuffer.toString(
        "utf-8",
        0,
        reader.currentBuffer.length
    );
    logDebug("Json string: ", json, "; ", reader.currentBuffer);
    const obj = JSON.parse(json);
    return obj;
}
function checkEndian() {
    const arrayBuffer = new ArrayBuffer(2);
    const uint8Array = new Uint8Array(arrayBuffer);
    const uint16array = new Uint16Array(arrayBuffer);
    uint8Array[0] = 0xaa; // set first byte
    uint8Array[1] = 0xbb; // set second byte
    if (uint16array[0] === 0xbbaa) return ByteOrder.LittleEndian;
    if (uint16array[0] === 0xaabb) return ByteOrder.BigEndian;
    else throw new Error("Something crazy just happened");
}

const machineByteOrder = checkEndian();

const typedArrayConstructor = {
    [ArrayDataType.Float32]: Float32Array,
    [ArrayDataType.Float64]: Float64Array,
    [ArrayDataType.Int8]: Int8Array,
    [ArrayDataType.Int16]: Int16Array,
    [ArrayDataType.Int32]: Int32Array,
    [ArrayDataType.Int64]: BigInt64Array,
    [ArrayDataType.Uint8]: Uint8Array,
    [ArrayDataType.Uint16]: Uint16Array,
    [ArrayDataType.Uint32]: Uint32Array,
    [ArrayDataType.Uint64]: BigUint64Array,
    [ArrayDataType.Bool]: Uint8Array,
};

const dataviewGetter = {
    [ArrayDataType.Float32]: DataView.prototype.getFloat32,
    [ArrayDataType.Float64]: DataView.prototype.getFloat64,
    [ArrayDataType.Int8]: DataView.prototype.getInt8,
    [ArrayDataType.Int16]: DataView.prototype.getInt16,
    [ArrayDataType.Int32]: DataView.prototype.getInt32,
    [ArrayDataType.Int64]: DataView.prototype.getBigInt64,
    [ArrayDataType.Uint8]: DataView.prototype.getUint8,
    [ArrayDataType.Uint16]: DataView.prototype.getUint16,
    [ArrayDataType.Uint32]: DataView.prototype.getUint32,
    [ArrayDataType.Uint64]: DataView.prototype.getBigUint64,
    [ArrayDataType.Bool]: DataView.prototype.getUint8,
};

function arrayBuilder(datatype: ArrayDataType, byteOrder: ByteOrder) {
    const ctor = typedArrayConstructor[datatype];
    const bytesPerElement = ctor.BYTES_PER_ELEMENT;
    if (datatype === ArrayDataType.Int64 || datatype === ArrayDataType.Uint64) {
        // BigInt64Array and BigUint64Array need special handling
        return (buffer: Buffer, padding: number) => {
            buffer = buffer.subarray(padding);
            const length = buffer.length / 8;
            const array = new ctor(length);
            for (let i = 0; i < length; i++) {
                const value = buffer.readBigInt64LE(i * 8);
                array[i] = value;
            }
            return array;
        };
    } else {
        if (byteOrder === machineByteOrder) {
            return (buffer: Buffer, padding: number) => {
                logDebug("Byte order is the same as machine byte order");
                return new ctor(
                    buffer,
                    buffer.byteOffset + padding,
                    buffer.byteLength / bytesPerElement
                );
            };
        } else {
            return (buffer: Buffer, padding: number) => {
                logDebug("Byte order is different from machine byte order");
                buffer = buffer.subarray(padding);
                const littelEndian = byteOrder === ByteOrder.LittleEndian;
                const dataview = new DataView(
                    buffer.buffer,
                    buffer.byteOffset,
                    buffer.byteLength
                );
                const getter = dataviewGetter[datatype].bind(dataview);
                const array = new ctor(buffer.byteLength / bytesPerElement);
                for (let i = 0; i < array.length; i++) {
                    const value = getter(i * bytesPerElement, littelEndian);
                    array[i] = value;
                }
                return array;
            };
        }
    }
}

function bufferToArray(
    buffer: Buffer,
    datatype: ArrayDataType,
    byteOrder: ByteOrder,
    numElements: number
) {
    logDebug("Buffer: ", buffer);
    logDebug("Buffer length: ", buffer.length);
    logDebug("Buffer byte length: ", buffer.byteLength);
    logDebug("Buffer byte offset: ", buffer.byteOffset);
    const arraySizeBytes =
        numElements * typedArrayConstructor[datatype].BYTES_PER_ELEMENT;
    logDebug("Array size (bytes): ", arraySizeBytes);
    const padding = buffer.length - arraySizeBytes;
    logDebug("Padding (bytes): ", padding);
    const array = arrayBuilder(datatype, byteOrder)(buffer, padding);
    logDebug("Typed array: ", array);
    return array;
}

type NumpyArray<T> = {
    dimensions: number[];
    data: T;
};

type Exception = {
    type: ExceptionType;
    message: string;
};

function parseNumpyArrayMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const dataType = reader.readUInt8() as ArrayDataType;
    logDebug("Data type (ui8): ", dataType, "; ", reader.currentBuffer);
    const byteOrder = reader.readUInt8();
    logDebug("Byte order (ui8): ", byteOrder, "; ", reader.currentBuffer);
    const numberOfDimensions = reader.readUInt8();
    logDebug(
        "Number of dimensions (ui8): ",
        numberOfDimensions,
        "; ",
        reader.currentBuffer
    );
    const dimensions = [];
    for (let i = 0; i < numberOfDimensions; i++) {
        dimensions.push(reader.readUInt32());
    }
    logDebug("Dimensions (ui32): ", dimensions, "; ", reader.currentBuffer);
    const numElements = dimensions.reduce((a, b) => a * b, 1);
    const data = reader.currentBuffer;
    const array = bufferToArray(data, dataType, byteOrder, numElements);
    const numpyArray: NumpyArray<typeof array> = {
        dimensions,
        data: array,
    };
    return numpyArray;
}

function parseExceptionMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const exceptionType = reader.readUInt8();
    logDebug(
        "Exception type (ui8): ",
        exceptionType,
        "; ",
        reader.currentBuffer
    );
    const message = reader.currentBuffer.toString(
        "utf-8",
        0,
        reader.currentBuffer.length
    );
    logDebug("Message: ", message, "; ", reader.currentBuffer);
    const exception: Exception = {
        type: exceptionType,
        message,
    };
    return exception;
}

class MessageChunks {
    private messageChunks: Buffer[] = [];
    private messageLength: number = 0;

    constructor(private expectedMessageLength: number) {}

    addChunk(chunk: Buffer) {
        const chunkLength = chunk.length;
        if (this.messageLength + chunkLength > this.expectedMessageLength) {
            throw new Error("Chunk is too big");
        }
        this.messageChunks.push(chunk);
        this.messageLength += chunkLength;
    }

    get isComplete() {
        return this.messageLength === this.expectedMessageLength;
    }

    fullMessage() {
        if (!this.isComplete) {
            throw new Error("Message is not complete");
        }
        const fullMessage = Buffer.concat(this.messageChunks);
        return fullMessage;
    }
}

function parseMessageLength(buffer: Buffer): [number, Buffer] {
    const reader = new StatefulReader(buffer);
    const messageLength = reader.readUInt32();
    return [messageLength, reader.currentBuffer];
}

function parseMessageType(buffer: Buffer): [MessageType, Buffer] {
    const reader = new StatefulReader(buffer);
    const messageType = reader.readUInt8();
    return [messageType, reader.currentBuffer];
}

class Client {
    private messageChunks?: MessageChunks = undefined;

    constructor(private socket: net.Socket) {}

    onData(
        data: Buffer,
        onMessage: (message: Message) => void,
        _onError: (error: Error) => void
    ) {
        if (this.messageChunks === undefined) {
            const [messageLength, messageData] = parseMessageLength(data);
            this.messageChunks = new MessageChunks(messageLength);
            this.messageChunks.addChunk(messageData);
        } else {
            this.messageChunks.addChunk(data);
        }

        if (this.messageChunks.isComplete) {
            const fullMessage = this.messageChunks.fullMessage();
            const [messageType, messageData] = parseMessageType(fullMessage);
            try {
                const message = parseMessage(messageType, messageData);
                onMessage(message);
            } catch (error) {
                logDebug("Error: ", error);
            }
            this.messageChunks = undefined;
        }
    }
}

@Service()
export class SocketServer {
    private server: net.Server;
    private port?: number = undefined;
    private started: boolean = false;
    private webviewClient?: net.Socket = undefined;

    constructor() {
        const options: net.ServerOpts = {
            allowHalfOpen: true,
            pauseOnConnect: false,
            keepAlive: true,
        };
        this.server = net.createServer(options);
        this.server.on("connection", this.onClientConnected);
    }

    async start() {
        if (this.started) {
            throw new Error("SocketServer already started");
        }
        this.server.listen(0);
        const address = this.server.address();
        if (typeof address === "string") {
            throw new Error("SocketServer address is a string");
        } else if (address === null) {
            throw new Error("SocketServer address is null");
        }
        this.port = address.port;
        logDebug("SocketServer started on port " + this.port);
        this.started = true;
    }

    get portNumber() {
        if (!this.started) {
            throw new Error("SocketServer is not started");
        }
        if (this.port === undefined) {
            throw new Error("SocketServer is not listening");
        }
        return this.port;
    }

    onClientConnected(socket: net.Socket): void {
        const onMessage = (message: Message) => {
            logDebug("Message: ", message);
            if (message.type === MessageType.WebviewHello) {
                this.webviewClient = socket;
                logDebug("Webview client connected");
            }
        };
        const onError = (error: Error) => {
            logDebug("Error: ", error);
        };

        logDebug("Client connected");
        const client = new Client(socket);
        socket.on("data", (data) => client.onData(data, onMessage, onError));
    }
}

// TODO: Remove this
// function logInfo(...obj: any[]): void {
//     console.log(...obj);
// }
function logDebug(...obj: any[]): void {
    console.log(...obj);
}
