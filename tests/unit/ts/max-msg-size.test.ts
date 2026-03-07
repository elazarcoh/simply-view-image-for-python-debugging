import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  HEADER_LENGTH,
  MAX_MESSAGE_SIZE,
  MessageType,
  Sender,
  splitHeaderContentRest,
} from '../../../src/python-communication/socket-based/protocol';

/**
 * Builds a minimal valid header buffer with the given field values.
 * Layout (all multi-byte fields are Big Endian):
 *   messageLength  4 bytes (UInt32BE)
 *   messageID      4 bytes (UInt32BE)
 *   sender         1 byte  (UInt8)
 *   requestId      4 bytes (UInt32BE)
 *   messageType    1 byte  (UInt8)
 *   chunkCount     4 bytes (UInt32BE)
 *   chunkNumber    4 bytes (UInt32BE)
 *   chunkLength    4 bytes (UInt32BE)
 *   [chunkData     chunkLength bytes]
 */
function buildBuffer(opts: {
  messageLength: number;
  messageID?: number;
  sender?: number;
  requestId?: number;
  messageType?: number;
  chunkCount?: number;
  chunkNumber?: number;
  chunkLength?: number;
  chunkData?: Buffer;
}): Buffer {
  const chunkData = opts.chunkData ?? Buffer.alloc(opts.chunkLength ?? 0);
  const buf = Buffer.alloc(HEADER_LENGTH + chunkData.length);
  let offset = 0;
  buf.writeUInt32BE(opts.messageLength, offset);
  offset += 4;
  buf.writeUInt32BE(opts.messageID ?? 1, offset);
  offset += 4;
  buf.writeUInt8(opts.sender ?? Sender.Python, offset);
  offset += 1;
  buf.writeUInt32BE(opts.requestId ?? 42, offset);
  offset += 4;
  buf.writeUInt8(opts.messageType ?? MessageType.PythonSendingObject, offset);
  offset += 1;
  buf.writeUInt32BE(opts.chunkCount ?? 1, offset);
  offset += 4;
  buf.writeUInt32BE(opts.chunkNumber ?? 0, offset);
  offset += 4;
  buf.writeUInt32BE(chunkData.length, offset);
  offset += 4;
  chunkData.copy(buf, offset);
  return buf;
}

describe('protocol constants', () => {
  it('hEADER_LENGTH is 26 bytes', () => {
    expect(HEADER_LENGTH).toBe(26);
  });

  it('mAX_MESSAGE_SIZE is 256 MB', () => {
    expect(MAX_MESSAGE_SIZE).toBe(256 * 1024 * 1024);
  });

  it('hEADER_LENGTH is less than MAX_MESSAGE_SIZE', () => {
    expect(HEADER_LENGTH).toBeLessThan(MAX_MESSAGE_SIZE);
  });
});

describe('splitHeaderContentRest', () => {
  describe('buffer too small for header', () => {
    it('returns Err when buffer is empty', () => {
      const result = splitHeaderContentRest(Buffer.alloc(0));
      expect(result.err).toBe(true);
    });

    it('returns Err when buffer is shorter than HEADER_LENGTH', () => {
      const result = splitHeaderContentRest(Buffer.alloc(HEADER_LENGTH - 1));
      expect(result.err).toBe(true);
    });

    it('error message mentions buffer and header lengths', () => {
      const result = splitHeaderContentRest(Buffer.alloc(10));
      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toMatch(/10/);
        expect(result.val).toMatch(String(HEADER_LENGTH));
      }
    });
  });

  describe('valid header — field round-trip', () => {
    it('parses a header-only message (chunkLength = 0) correctly', () => {
      const buf = buildBuffer({ messageLength: HEADER_LENGTH });
      const result = splitHeaderContentRest(buf);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [header, content, rest] = result.val;
        expect(header.messageLength).toBe(HEADER_LENGTH);
        expect(header.messageID).toBe(1);
        expect(header.sender).toBe(Sender.Python);
        expect(header.requestId).toBe(42);
        expect(header.messageType).toBe(MessageType.PythonSendingObject);
        expect(header.chunkCount).toBe(1);
        expect(header.chunkNumber).toBe(0);
        expect(header.chunkLength).toBe(0);
        expect(content.length).toBe(0);
        expect(rest.length).toBe(0);
      }
    });

    it('parses a message with chunk data and returns it in content', () => {
      const chunkData = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
      const buf = buildBuffer({
        messageLength: HEADER_LENGTH + chunkData.length,
        chunkData,
      });
      const result = splitHeaderContentRest(buf);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [header, content, rest] = result.val;
        expect(header.chunkLength).toBe(4);
        expect(content).toEqual(chunkData);
        expect(rest.length).toBe(0);
      }
    });

    it('returns trailing bytes as rest when buffer contains more than one message', () => {
      const chunkData = Buffer.from([0x01, 0x02]);
      const trailing = Buffer.from([0xFF, 0xFE]);
      const msgBuf = buildBuffer({
        messageLength: HEADER_LENGTH + chunkData.length,
        chunkData,
      });
      const combined = Buffer.concat([msgBuf, trailing]);
      const result = splitHeaderContentRest(combined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [, , rest] = result.val;
        expect(rest).toEqual(trailing);
      }
    });

    it('all custom field values round-trip through the header', () => {
      const buf = buildBuffer({
        messageLength: HEADER_LENGTH,
        messageID: 0xDEADBEEF >>> 0,
        sender: Sender.Server,
        requestId: 0x12345678,
        messageType: MessageType.PythonSendingObject,
        chunkCount: 7,
        chunkNumber: 3,
        chunkLength: 0,
      });
      const result = splitHeaderContentRest(buf);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [header] = result.val;
        expect(header.messageID).toBe(0xDEADBEEF >>> 0);
        expect(header.sender).toBe(Sender.Server);
        expect(header.requestId).toBe(0x12345678);
        expect(header.chunkCount).toBe(7);
        expect(header.chunkNumber).toBe(3);
      }
    });
  });

  describe('message size fields — server-side validation surface', () => {
    it('parses a header where messageLength exceeds MAX_MESSAGE_SIZE (server must reject it)', () => {
      // splitHeaderContentRest itself does not validate MAX_MESSAGE_SIZE;
      // that check lives in Server.ts after parsing. This test documents
      // the contract: the parsed header faithfully reflects the oversized value
      // so the caller can detect and reject it.
      const oversized = MAX_MESSAGE_SIZE + 1;
      const buf = buildBuffer({ messageLength: oversized });
      const result = splitHeaderContentRest(buf);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [header] = result.val;
        expect(header.messageLength).toBe(oversized);
        expect(header.messageLength).toBeGreaterThan(MAX_MESSAGE_SIZE);
      }
    });

    it('parses a header where messageLength is exactly MAX_MESSAGE_SIZE', () => {
      const buf = buildBuffer({ messageLength: MAX_MESSAGE_SIZE });
      const result = splitHeaderContentRest(buf);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [header] = result.val;
        expect(header.messageLength).toBe(MAX_MESSAGE_SIZE);
      }
    });

    it('parses a header where messageLength equals HEADER_LENGTH (minimal valid)', () => {
      const buf = buildBuffer({ messageLength: HEADER_LENGTH });
      const result = splitHeaderContentRest(buf);
      expect(result.ok).toBe(true);
    });
  });
});
