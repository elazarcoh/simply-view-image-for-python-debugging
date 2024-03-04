import { Service } from "typedi";
import * as net from "net";
import { RequestsManager } from "./RequestsManager";
import { MessageChunkHeader, splitHeaderContentRest } from "./protocol";
import { MessageChunks } from "./MessageChunks";
import { logDebug, logInfo, logTrace } from "../../Logging";

const EMPTY_BUFFER = Buffer.alloc(0);

@Service()
export class SocketServer {
    public readonly server: net.Server;
    private port?: number = undefined;
    private started: boolean = false;

    private outgoingRequestsManager: RequestsManager = new RequestsManager();
    private chunksByMessageId: Map<number, MessageChunks> = new Map();

    constructor() {
        const options: net.ServerOpts = {
            allowHalfOpen: true,
            pauseOnConnect: false,
            keepAlive: true,
        };
        this.server = net.createServer(options);
        this.server.on("connection", this.onClientConnected.bind(this));
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
        logInfo("SocketServer started on port " + this.port);
        this.started = true;
    }

    get isListening() {
        return this.server.listening;
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
        const outgoingRequestsManager = this.outgoingRequestsManager;
        const handleMessage = (header: MessageChunkHeader, data: Buffer) => {
            logTrace(
                "Received message from client. Request id:",
                header.requestId
            );
            if (outgoingRequestsManager.hasRequest(header.requestId)) {
                // handle as response
                outgoingRequestsManager.onData(header, data);
            } else {
                // handle as request
                // const message = parseMessage(header, data);
                // logDebug("Parsed message from client", message);
            }
        };

        let waitingForHandling: Buffer = Buffer.alloc(0);
        const handleData = (data: Buffer) => {
            logTrace(`Received ${data.length} bytes from client`);
            while (waitingForHandling.length > 0 || data.length > 0) {
                if (waitingForHandling.length > 0) {
                    const fullData = Buffer.concat([waitingForHandling, data]);
                    waitingForHandling = EMPTY_BUFFER;
                    data = fullData;
                }

                const parsed = splitHeaderContentRest(data);
                if (parsed.err) {
                    logTrace("Waiting for more data");
                    waitingForHandling = data;
                    return;
                }

                const [header, content, rest] = parsed.safeUnwrap();
                if (rest.length > 0) {
                    logTrace("Received more data than expected");
                    waitingForHandling = rest;
                }
                logTrace("Parsed header", header);
                data = EMPTY_BUFFER;

                const chunks = setDefault(
                    this.chunksByMessageId,
                    header.messageID,
                    () => new MessageChunks(header.messageLength, header.chunkCount) 
                );
                chunks.addChunk(header, content);

                if (chunks.isComplete()) {
                    logTrace("Message is complete");
                    const fullMessage = chunks.fullMessage();
                    handleMessage(header, fullMessage);
                }
            }
        };
        const makeSafe = (fn: (...args: any[]) => void) => {
            return (...args: any[]) => {
                try {
                    fn(...args);
                } catch (err) {
                    logDebug("Error in handler");
                    logDebug(err);
                }
            };
        };

        socket.on("data", makeSafe(handleData));
        socket.on("close", () => {
            logTrace("Client closed connection");
        });
        socket.on("end", () => {
            logTrace("Client ended connection");
        });
        socket.on("error", (err) => {
            logDebug("Client connection error");
            logDebug(err);
        });
    }

    onResponse(
        requestId: number,
        callback: (header: MessageChunkHeader, data: Buffer) => void
    ) {
        this.outgoingRequestsManager.subscribeRequest(requestId, (header, data) => {
            this.outgoingRequestsManager.unsubscribeRequest(requestId);
            callback(header, data);
        });
    }
}

export function setDefault<K, V>(map: Map<K, V>, key: K, ctor: () => V): V {
    if (!map.has(key)) {
        map.set(key, ctor());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion  -- we just set it
    return map.get(key)!;
}
