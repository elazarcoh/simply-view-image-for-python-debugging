import { MessageChunkHeader, RequestId } from "./protocol";

export type OnDataCallback = (header: MessageChunkHeader, data: Buffer) => void;

export class RequestsManager {
    private requests: Map<RequestId, OnDataCallback> = new Map();

    static randomRequestId() {
        return Math.floor(Math.random() * 2 ** 32);
    }

    hasRequest(request_id: RequestId) {
        return this.requests.has(request_id);
    }

    subscribeRequest(request_id: RequestId, callback: OnDataCallback) {
        this.requests.set(request_id, callback);
    }

    unsubscribeRequest(request_id: RequestId) {
        this.requests.delete(request_id);
    }

    onData(header: MessageChunkHeader, data: Buffer) {
        const { requestId } = header;
        const callback = this.requests.get(requestId);
        if (callback) {
            callback(header, data);
        }
    }
}
