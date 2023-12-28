export class StatefulBufferWriter {
    readonly functions: {
        [key: string]: [number, (value: number) => number];
    } = {
        writeUInt8: [1, Buffer.prototype.writeUInt8],
        writeUInt16: [2, Buffer.prototype.writeUInt16BE],
        writeUInt32: [4, Buffer.prototype.writeUInt32BE],
        writeFloat32: [4, Buffer.prototype.writeFloatBE],
        writeFloat64: [8, Buffer.prototype.writeDoubleBE],
        writeInt8: [1, Buffer.prototype.writeInt8],
        writeInt32: [4, Buffer.prototype.writeInt32BE],
        writeInt16: [2, Buffer.prototype.writeInt16BE],
    };

    constructor(private buffer: Buffer) {}

    get currentBuffer() {
        return this.buffer;
    }

    private writer([length, writeFunction]: [
        number,
        (value: number) => number
    ]) {
        return (value: number) => {
            const result = writeFunction.call(this.buffer, value);
            const newBuffer = this.buffer.subarray(length);
            this.buffer = newBuffer;
            return result;
        };
    }

    writeUInt8(value: number) {
        return this.writer(this.functions.writeUInt8)(value);
    }
    writeUInt32(value: number) {
        return this.writer(this.functions.writeUInt32)(value);
    }
    writeFloat32(value: number) {
        return this.writer(this.functions.writeFloat32)(value);
    }
    writeFloat64(value: number) {
        return this.writer(this.functions.writeFloat64)(value);
    }
    writeInt8(value: number) {
        return this.writer(this.functions.writeInt8)(value);
    }
    writeInt32(value: number) {
        return this.writer(this.functions.writeInt32)(value);
    }
    writeInt16(value: number) {
        return this.writer(this.functions.writeInt16)(value);
    }
}
