import { Service } from "typedi";
import { Server } from "ws";
import { logDebug } from "../../Logging";

// simple echo websocket server
@Service()
export class WebsocketServer {
    readonly server: Server;
    readonly port: number;

    constructor() {
        this.server = new Server({ port: 44455 });

        const address = this.server.address();
        if (typeof address === "string") {
            throw new Error("SocketServer address is a string");
        } else if (address === null) {
            throw new Error("SocketServer address is null");
        }
        this.port = address.port;

        // let interval: NodeJS.Timeout;
        this.server.on("connection", (ws) => {
            ws.on("message", (message, isBinary) => {
                logDebug(`isBinary: ${isBinary}`);
                logDebug(`typeof message: ${typeof message}`);
                const isBuffer = message instanceof Buffer;
                logDebug(`isBuffer: ${isBuffer}`);
                const buffer = Buffer.alloc((message as Buffer).length);
                (message as Buffer).copy(buffer);
                const lenfth = buffer.length;
                logDebug(`buffer length: ${lenfth}`);
                logDebug("buffer: ", buffer);
                ws.send("echo: " + message);
            });

            logDebug("sending connected");
            ws.send("connected!");
            
            // interval = setInterval(() => {
            //     logDebug("sending interval");
            //     ws.send("interval!");
            // }, 1000);
        });
        this.server.on("listening", () => {
            logDebug("Websocket server listening");
        });
        this.server.on("error", (err) => {
            logDebug("Websocket server error");
            logDebug(err);
        });
        this.server.on("close", () => {
            logDebug("Websocket server closed");
            // clearInterval(interval);
        });
        
    }
}

// function logDebug(...obj: any[]): void {
//     console.log(...obj);
// }
