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

        this.server.on("connection", (ws) => {
            ws.on("message", (message) => {
                logDebug(`received: ${message}`);
                ws.send("echo: " + message);
            });

            logDebug("sending connected");
            ws.send("connected!");
        });
    }
}
