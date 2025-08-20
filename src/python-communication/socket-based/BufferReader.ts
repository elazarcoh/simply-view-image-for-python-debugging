import { Buffer } from 'node:buffer';

export class StatefulBufferReader {
  readonly functions: {
    [key: string]: [number, (offset?: number) => number];
  } = {
    readUInt8: [1, Buffer.prototype.readUInt8],
    readUInt16: [2, Buffer.prototype.readUInt16BE],
    readUInt32: [4, Buffer.prototype.readUInt32BE],
    readFloat32: [4, Buffer.prototype.readFloatBE],
    readFloat64: [8, Buffer.prototype.readDoubleBE],
    readInt8: [1, Buffer.prototype.readInt8],
    readInt32: [4, Buffer.prototype.readInt32BE],
    readInt16: [2, Buffer.prototype.readInt16BE],
  };

  constructor(private buffer: Buffer) {}

  get currentBuffer() {
    return this.buffer;
  }

  private read([length, readFunction]: [number, (offset?: number) => number]) {
    const result = readFunction.call(this.buffer, 0);
    const newBuffer = this.buffer.subarray(length);
    this.buffer = newBuffer;
    return result;
  }

  readUInt8() {
    return this.read(this.functions.readUInt8);
  }

  readUInt32() {
    return this.read(this.functions.readUInt32);
  }

  readFloat32() {
    return this.read(this.functions.readFloat32);
  }

  readFloat64() {
    return this.read(this.functions.readFloat64);
  }

  readInt8() {
    return this.read(this.functions.readInt8);
  }

  readInt32() {
    return this.read(this.functions.readInt32);
  }

  readInt16() {
    return this.read(this.functions.readInt16);
  }

  readString() {
    const length = this.readUInt32();
    const result = this.buffer.toString('utf-8', 0, length);
    const newBuffer = this.buffer.subarray(length);
    this.buffer = newBuffer;
    return result;
  }
}
