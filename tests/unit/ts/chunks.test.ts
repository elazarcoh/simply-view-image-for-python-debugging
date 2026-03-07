import type { MessageChunkHeader } from '../../../src/python-communication/socket-based/protocol';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { MessageChunks } from '../../../src/python-communication/socket-based/MessageChunks';
import { MessageType, Sender } from '../../../src/python-communication/socket-based/protocol';

function makeHeader(overrides: Partial<MessageChunkHeader> = {}): MessageChunkHeader {
  return {
    messageID: 1,
    chunkNumber: 0,
    chunkCount: 1,
    messageLength: 0,
    chunkLength: 0,
    sender: Sender.Python,
    messageType: MessageType.PythonSendingObject,
    requestId: 42,
    ...overrides,
  };
}

describe('messageChunks', () => {
  it('isComplete() returns false on a new instance', () => {
    expect(new MessageChunks(10, 2).isComplete()).toBe(false);
  });

  describe('single chunk messages', () => {
    it('isComplete() returns true after adding the single chunk', () => {
      const data = Buffer.from('hello');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length, chunkLength: data.length, chunkCount: 1, chunkNumber: 0 });
      chunks.addChunk(header, data);
      expect(chunks.isComplete()).toBe(true);
    });

    it('fullMessage() returns exact buffer that was added', () => {
      const data = Buffer.from('hello world');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length, chunkLength: data.length, chunkCount: 1, chunkNumber: 0 });
      chunks.addChunk(header, data);
      expect(chunks.fullMessage()).toEqual(data);
    });
  });

  describe('multi-chunk messages (ordered)', () => {
    it('is not complete until all chunks are received', () => {
      const part0 = Buffer.from('foo');
      const part1 = Buffer.from('bar');
      const totalLen = part0.length + part1.length;
      const chunks = new MessageChunks(totalLen, 2);

      const h0 = makeHeader({ messageLength: totalLen, chunkCount: 2, chunkNumber: 0, chunkLength: part0.length });
      chunks.addChunk(h0, part0);
      expect(chunks.isComplete()).toBe(false);
    });

    it('is complete after all chunks arrive in order', () => {
      const part0 = Buffer.from('foo');
      const part1 = Buffer.from('bar');
      const totalLen = part0.length + part1.length;
      const chunks = new MessageChunks(totalLen, 2);

      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 2, chunkNumber: 0, chunkLength: part0.length }), part0);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 2, chunkNumber: 1, chunkLength: part1.length }), part1);
      expect(chunks.isComplete()).toBe(true);
    });

    it('fullMessage() returns correct concatenation', () => {
      const part0 = Buffer.from('foo');
      const part1 = Buffer.from('bar');
      const totalLen = part0.length + part1.length;
      const chunks = new MessageChunks(totalLen, 2);

      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 2, chunkNumber: 0, chunkLength: part0.length }), part0);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 2, chunkNumber: 1, chunkLength: part1.length }), part1);
      expect(chunks.fullMessage()).toEqual(Buffer.concat([part0, part1]));
    });
  });

  describe('multi-chunk messages (out-of-order)', () => {
    it('is complete even when chunks arrive out of order', () => {
      const part0 = Buffer.from('aaa');
      const part1 = Buffer.from('bbb');
      const part2 = Buffer.from('ccc');
      const totalLen = part0.length + part1.length + part2.length;
      const chunks = new MessageChunks(totalLen, 3);

      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 3, chunkNumber: 2, chunkLength: part2.length }), part2);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 3, chunkNumber: 0, chunkLength: part0.length }), part0);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 3, chunkNumber: 1, chunkLength: part1.length }), part1);
      expect(chunks.isComplete()).toBe(true);
    });

    it('fullMessage() assembles in chunk-number order, not receive order', () => {
      const part0 = Buffer.from('aaa');
      const part1 = Buffer.from('bbb');
      const part2 = Buffer.from('ccc');
      const totalLen = part0.length + part1.length + part2.length;
      const chunks = new MessageChunks(totalLen, 3);

      // Add in reverse order
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 3, chunkNumber: 2, chunkLength: part2.length }), part2);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 3, chunkNumber: 1, chunkLength: part1.length }), part1);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 3, chunkNumber: 0, chunkLength: part0.length }), part0);

      expect(chunks.fullMessage()).toEqual(Buffer.concat([part0, part1, part2]));
    });
  });

  describe('validation (error cases)', () => {
    it('throws when adding a duplicate chunk with different header fields', () => {
      const data = Buffer.from('hello');
      const totalLen = data.length;
      const chunks = new MessageChunks(totalLen, 1);
      const header = makeHeader({ messageLength: totalLen, chunkCount: 1, chunkNumber: 0, chunkLength: data.length });
      chunks.addChunk(header, data);

      const dupHeader = makeHeader({ messageID: 99, messageLength: totalLen, chunkCount: 1, chunkNumber: 0, chunkLength: data.length });
      expect(() => chunks.addChunk(dupHeader, data)).toThrow();
    });

    it('throws when header chunkCount does not match constructor', () => {
      const data = Buffer.from('hi');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length, chunkCount: 2, chunkNumber: 0, chunkLength: data.length });
      expect(() => chunks.addChunk(header, data)).toThrow();
    });

    it('throws when header messageLength does not match constructor', () => {
      const data = Buffer.from('hi');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length + 5, chunkCount: 1, chunkNumber: 0, chunkLength: data.length });
      expect(() => chunks.addChunk(header, data)).toThrow();
    });

    it('throws when declared chunkLength does not match buffer size', () => {
      const data = Buffer.from('hi');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length, chunkCount: 1, chunkNumber: 0, chunkLength: 99 });
      expect(() => chunks.addChunk(header, data)).toThrow();
    });

    it('throws when chunk number is out of valid range', () => {
      const data = Buffer.from('hello');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length, chunkCount: 1, chunkNumber: 1, chunkLength: data.length });
      expect(() => chunks.addChunk(header, data)).toThrow();
    });
  });

  describe('fullMessage() and idempotency', () => {
    it('fullMessage() throws if called before all chunks are received', () => {
      const part = Buffer.from('foo');
      const totalLen = part.length * 2;
      const chunks = new MessageChunks(totalLen, 2);
      chunks.addChunk(makeHeader({ messageLength: totalLen, chunkCount: 2, chunkNumber: 0, chunkLength: part.length }), part);
      expect(() => chunks.fullMessage()).toThrow('Message is not complete');
    });

    it('adding the same chunk twice is idempotent', () => {
      const data = Buffer.from('hello');
      const chunks = new MessageChunks(data.length, 1);
      const header = makeHeader({ messageLength: data.length, chunkCount: 1, chunkNumber: 0, chunkLength: data.length });
      chunks.addChunk(header, data);
      expect(() => chunks.addChunk(header, data)).not.toThrow();
      expect(chunks.isComplete()).toBe(true);
      expect(chunks.fullMessage()).toEqual(data);
    });
  });

  describe('integration: roundtrip', () => {
    it('reassembles original payload split into multiple chunks', () => {
      const payload = Buffer.from('The quick brown fox jumps over the lazy dog');
      const chunkSize = 10;
      const chunkCount = Math.ceil(payload.length / chunkSize);
      const chunks = new MessageChunks(payload.length, chunkCount);

      // Build chunk buffers
      const chunkBuffers: Buffer[] = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkBuffers.push(payload.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, payload.length)));
      }

      // Add in reverse order to verify out-of-order works
      for (let i = chunkCount - 1; i >= 0; i--) {
        chunks.addChunk(
          makeHeader({
            messageLength: payload.length,
            chunkCount,
            chunkNumber: i,
            chunkLength: chunkBuffers[i].length,
          }),
          chunkBuffers[i],
        );
      }

      expect(chunks.isComplete()).toBe(true);
      expect(chunks.fullMessage()).toEqual(payload);
    });
  });
});
