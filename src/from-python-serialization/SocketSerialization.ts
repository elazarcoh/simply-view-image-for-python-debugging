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
//       Number of dimensions (1 byte)
//       Dimensions (4 bytes each)
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
//
//    -1. Exception => 0xff
//       Object data format:
//       Exception type (1 byte)
//       Exception message (length bytes)


enum MessageType {
    PythonSendingObject = 0x01,
}
enum ObjectType {
    NumpyArray = 0x01,
    Exception = 0xff,
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

function parseMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const _messageLength = reader.readUInt32();
    logDebug("Message length (ui32): ", _messageLength, "; ", reader.currentBuffer);
    const messageType = reader.readUInt8();
    logDebug("Message type (ui8): ", messageType, "; ", reader.currentBuffer);
    switch (messageType) {
        case MessageType.PythonSendingObject:
            return parsePythonSendingObjectMessage(reader.currentBuffer);
        default:
            throw new Error("Unknown message type: " + messageType);
    }
}

function parsePythonSendingObjectMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const _requestId = reader.readUInt32();
    logDebug("Request ID (ui32): ", _requestId, "; ", reader.currentBuffer);
    const _objectId = reader.readUInt32();
    logDebug("Object ID (ui32): ", _objectId, "; ", reader.currentBuffer);
    const objectType = reader.readUInt8();
    logDebug("Object type (ui8): ", objectType, "; ", reader.currentBuffer);
    switch (objectType) {
        case ObjectType.NumpyArray:
            return parseNumpyArrayMessage(reader.currentBuffer);
        case ObjectType.Exception:
            return parseExceptionMessage(reader.currentBuffer);
        default:
            throw new Error("Unknown object type: "+ objectType);
    }
}

function getTypedArrayConstructor(datatype: ArrayDataType) {
    switch (datatype) {
        case ArrayDataType.Float32:
            return Float32Array;
        case ArrayDataType.Float64:
            return Float64Array;
        case ArrayDataType.Int8:
            return Int8Array;
        case ArrayDataType.Int16:
            return Int16Array;
        case ArrayDataType.Int32:
            return Int32Array;
        case ArrayDataType.Int64:
            return BigInt64Array;
        case ArrayDataType.Uint8:
            return Uint8Array;
        case ArrayDataType.Uint16:
            return Uint16Array;
        case ArrayDataType.Uint32:
            return Uint32Array;
        case ArrayDataType.Uint64:
            return BigUint64Array;
        case ArrayDataType.Bool:
            return Uint8Array;
        default:
            throw new Error("Unknown datatype: " + datatype);
    }
}

function bufferToArray(
    buffer: Buffer,
    datatype: ArrayDataType
) {
    const ctor = getTypedArrayConstructor(datatype);
    const array = new ctor(buffer.buffer, buffer.byteOffset, buffer.length / ctor.BYTES_PER_ELEMENT);
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
    const dataType = reader.readUInt8();
    logDebug("Data type (ui8): ", dataType, "; ", reader.currentBuffer);
    const numberOfDimensions = reader.readUInt8();
    logDebug("Number of dimensions (ui8): ", numberOfDimensions, "; ", reader.currentBuffer);
    const dimensions = [];
    for (let i = 0; i < numberOfDimensions; i++) {
        dimensions.push(reader.readUInt32());
    }
    logDebug("Dimensions (ui32): ", dimensions, "; ", reader.currentBuffer);
    const data = reader.currentBuffer;
    const array = bufferToArray(data, dataType);
    const numpyArray: NumpyArray<typeof array> = {
        dimensions,
        data: array,
    };
    return numpyArray;
}

function parseExceptionMessage(buffer: Buffer) {
    const reader = new StatefulReader(buffer);
    const exceptionType = reader.readUInt8();
    logDebug("Exception type (ui8): ", exceptionType, "; ", reader.currentBuffer);
    const message = reader.currentBuffer.toString("utf-8", 0, reader.currentBuffer.length);
    logDebug("Message: ", message, "; ", reader.currentBuffer);
    const exception: Exception = {
        type: exceptionType,
        message,
    };
    return exception;
}

@Service()
export class SocketServer {
    private server: net.Server;
    private port?: number = undefined;
    private started: boolean = false;

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
        logInfo("Client connected");
        socket.on("data", (data) => {
            logDebug("Received data from client: " , data);
            try {
                const message = parseMessage(data);
                console.log(message);
            } catch (e) {
                console.error(e);
            }
        });
    }
}

// TODO: Remove this
function logInfo(...obj: any[]): void {
    console.log(...obj);
}
function logDebug(...obj: any[]): void {
    console.log(...obj);
}