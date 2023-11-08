import { v4 } from "uuid";
import { MessageHandlerData } from "./MessageHandlerData";
import { Messenger } from "./Messenger";

class MessageHandler {
    private static instance: MessageHandler;
    public readonly listeners: {
        [commandId: string]: (...args: any[]) => unknown | undefined;
    } = {};

    public static getInstance(): MessageHandler {
        if (MessageHandler.instance === undefined) {
            MessageHandler.instance = new MessageHandler();
        }
        return MessageHandler.instance;
    }

    private constructor() {
        Messenger.listen(
            (message: MessageEvent<MessageHandlerData<unknown>>) => {
                const { requestId, payload, error } = message.data;

                if (
                    requestId !== undefined &&
                    this.listeners[requestId] !== undefined
                ) {
                    this.listeners[requestId](payload, error);
                }
            }
        );
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
            this.listeners[requestId] = (payload: T, error?: unknown) => {
                if (error !== undefined && error !== null) {
                    reject(error);
                } else {
                    resolve(payload);
                }

                if (this.listeners[requestId] !== undefined) {
                    delete this.listeners[requestId];
                }
            };

            Messenger.sendWithReqId(message, requestId, payload);
        });
    }
}

export const messageHandler = MessageHandler.getInstance();
