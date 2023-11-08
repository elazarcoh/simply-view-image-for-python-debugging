import { v4 } from "uuid";
import { MessageHandlerData } from "./MessageHandlerData";
import { Messenger } from "./Messenger";

class MessageHandler<C> {
    private readonly requestsListeners: {
        [requestId: string]: (...args: any[]) => unknown | undefined;
    } = {};
    private readonly commandsListeners = new Map<keyof C, (...args: any[]) => void>();

    constructor() {
        Messenger.listen(
            (message: MessageEvent<MessageHandlerData<unknown>>) => {
                const {
                    requestId,
                    payload,
                    error,
                    command = undefined,
                } = message.data;

                if (requestId !== undefined) {
                    if (
                        requestId !== undefined &&
                        this.requestsListeners[requestId] !== undefined
                    ) {
                        this.requestsListeners[requestId](payload, error);
                    }
                } else {
                    if (
                        command !== undefined &&
                        this.commandsListeners.has(command as keyof C)
                    ) {
                        this.commandsListeners.get(command as keyof C)?.(payload);
                    }
                }
            }
        );
    }

    public listenToCommand<CC extends keyof C>(
        command: CC,
        callback: (payload: C[CC], error?: unknown) => void
    ): void {
        this.commandsListeners.set(command, callback);
    }

    /**
     * Send message to the extension layer
     * @param message
     * @param payload
     */
    public send<P = unknown>(message: string, payload?: P): void {
        Messenger.send(message, payload);
    }

    /**
     * Request data from the extension layer
     * @param message
     * @param payload
     * @returns
     */
    public request<T, P = unknown>(message: string, payload?: P): Promise<T> {
        const requestId = v4();

        return new Promise((resolve, reject) => {
            this.requestsListeners[requestId] = (
                payload: T,
                error?: unknown
            ) => {
                if (error !== undefined && error !== null) {
                    reject(error);
                } else {
                    resolve(payload);
                }

                if (this.requestsListeners[requestId] !== undefined) {
                    delete this.requestsListeners[requestId];
                }
            };

            Messenger.sendWithReqId(message, requestId, payload);
        });
    }
}

let messageHandler: MessageHandler<unknown>;
export function messageHandlerInstance<C>(): MessageHandler<C> {
    if (messageHandler === undefined) {
        messageHandler = new MessageHandler();
    }
    return messageHandler as MessageHandler<C>;
}
