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
                `Expected chunk count ${this.expectedChunkCount} but got ${chunkCount}`
            );
        }
        if (totalLength !== this.expectedMessageLength) {
            throw new Error(
                `Expected message length ${this.expectedMessageLength} but got ${totalLength}`
            );
        }
        if (chunkNumber >= this.expectedChunkCount) {
            throw new Error(
                `Chunk number ${chunkNumber} is out of bounds (chunk count is ${chunkCount})`
            );
        }
        if (chunkLength !== chunk.length) {
            throw new Error(
                `Chunk length ${chunkLength} does not match chunk length ${chunk.length}`
            );
        }
        if (this.messageHeaders[chunkNumber] !== null) {
            throw new Error(
                `Chunk number ${chunkNumber} already exists. current: ${JSON.stringify(this.messageHeaders[chunkNumber])}`
            );
        }
        if (this.messageChunks[chunkNumber] !== null) {
            throw new Error(`Chunk number ${chunkNumber} already exists. current with length: ${this.messageChunks[chunkNumber]?.length}`);
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
