import type { WebviewApi} from "vscode-webview";
import { EventData } from "./EventData";

export interface ClientVsCode<T> {
    getState: () => T;
    setState: (data: T) => void;
    postMessage: (msg: unknown) => void;
}

export class Messenger {
    private static vscode: unknown;

    /**
     * Get the VS Code API in your webview
     * @returns {ClientVsCode<T>}
     */
    public static getVsCodeAPI<T>(): WebviewApi<T> {
        if (Messenger.vscode === undefined) {
            Messenger.vscode = acquireVsCodeApi();
        }
        return Messenger.vscode as WebviewApi<T>;
    }

    /**
     * Listen to the message from your extension
     * @param callback
     */
    public static listen<T>(
        callback: (event: MessageEvent<EventData<T>>) => void
    ): void {
        window.addEventListener("message", callback);
    }

    /**
     * Remove the listener from the webview
     * @param callback
     */
    public static unlisten<T>(
        callback: (event: MessageEvent<EventData<T>>) => void
    ): void {
        window.removeEventListener("message", callback);
    }

    /**
     * Send a message from the webview to the extension
     * @param command
     * @param payload
     */
    public static send<P = unknown>(command: string, payload?: P): void {
        const vscode = Messenger.getVsCodeAPI();
        if (payload !== undefined) {
            vscode.postMessage({ command, payload });
        } else {
            vscode.postMessage({ command });
        }
    }

    /**
     * Send a message from the webview to the extension with a request ID (required for async/await responses)
     * @param command
     * @param requestId
     * @param payload
     */
    public static sendWithReqId<P = unknown>(
        command: string,
        requestId: string,
        payload?:  P
    ): void {
        const vscode = Messenger.getVsCodeAPI();
        if (payload !== undefined) {
            vscode.postMessage({ command, requestId, payload });
        } else {
            vscode.postMessage({ command, requestId });
        }
    }

    /**
     * Get the state of the extension
     * @returns
     */
    public static getState = () => {
        const vscode = Messenger.getVsCodeAPI();
        return vscode.getState();
    };

    /**
     * Set the state of the extension
     * @returns
     */
    public static setState = <T>(data: T) => {
        const vscode = Messenger.getVsCodeAPI();
        vscode.setState({
            ...data,
        });
    };
}
