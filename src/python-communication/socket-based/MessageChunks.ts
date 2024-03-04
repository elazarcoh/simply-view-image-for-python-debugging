import { logDebug } from "../../Logging";
import { MessageChunkHeader } from "./protocol";

export class MessageChunks {
    private messageChunks: (Buffer | null)[];
    private messageHeaders: (MessageChunkHeader | null)[] = [];
    private messageLength: number = 0;

    constructor(
        private expectedMessageLength: number,
        private expectedChunkCount: number
    ) {
        this.messageChunks = new Array(expectedChunkCount).fill(null);
        this.messageHeaders = new Array(expectedChunkCount).fill(null);
    }

    addChunk(header: MessageChunkHeader, chunk: Buffer) {
        const {
            chunkNumber,
            chunkCount,
            chunkLength,
            messageLength: totalLength,
        } = header;
        if (chunkCount !== this.expectedChunkCount) {
            throw new Error(
                `(reqId ${header.requestId}) Expected chunk count ${this.expectedChunkCount} but got ${chunkCount}`
            );
        }
        if (totalLength !== this.expectedMessageLength) {
            throw new Error(
                `(reqId ${header.requestId}) Expected message length ${this.expectedMessageLength} but got ${totalLength}`
            );
        }
        if (chunkNumber >= this.expectedChunkCount) {
            throw new Error(
                `(reqId ${header.requestId}) Chunk number ${chunkNumber} is out of bounds (chunk count is ${chunkCount})`
            );
        }
        if (chunkLength !== chunk.length) {
            throw new Error(
                `(reqId ${header.requestId}) Chunk length ${chunkLength} does not match chunk length ${chunk.length}`
            );
        }
        const currentHeader = this.messageHeaders[chunkNumber];
        if (currentHeader !== null) {
            // got the same chunk twice. check if it's the same, if not, throw an error
            if (currentHeader.messageID !== header.messageID ||
                currentHeader.chunkCount !== header.chunkCount ||
                currentHeader.chunkLength !== header.chunkLength ||
                currentHeader.messageLength !== header.messageLength||
                currentHeader.requestId !== header.requestId ||
                currentHeader.sender !== header.sender ||
                currentHeader.messageType !== header.messageType
                ) {
                throw new Error(
                    `(reqId ${header.requestId}) Chunk number ${chunkNumber} already exists. current: ${JSON.stringify(this.messageHeaders[chunkNumber])}`
                );
            } else {
                logDebug(`(reqId ${header.requestId}) Got the same chunk twice. Chunk number: ${chunkNumber}. Ignoring.`);
                return;
            }
        }
        const currentChunk = this.messageChunks[chunkNumber];
        if (currentChunk !== null) {
            // got the same chunk twice. check if it's the same, if not, throw an error
            if (!currentChunk.equals(chunk)) {
                throw new Error(
                    `(reqId ${header.requestId}) Chunk number ${chunkNumber} already exists. current with length: ${this.messageChunks[chunkNumber]?.length}`
                );
            } else {
                logDebug(`(reqId ${header.requestId}) Got the same chunk twice. Chunk number: ${chunkNumber}. Ignoring.`);
                return;
            }
        }

        this.messageChunks[chunkNumber] = chunk;
        this.messageHeaders[chunkNumber] = header;
        this.messageLength += chunkLength;
    }

    isComplete() {
        return (
            this.messageLength === this.expectedMessageLength &&
            this.messageChunks.every((chunk) => chunk !== null)
        );
    }

    fullMessage() {
        if (!this.isComplete()) {
            throw new Error("Message is not complete");
        }
        // @ts-expect-error  - we checked that all chunks are not null
        const fullMessage = Buffer.concat(this.messageChunks);
        return fullMessage;
    }
}
