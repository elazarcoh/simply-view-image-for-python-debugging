import { Buffer } from 'node:buffer';
import * as net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEADER_LENGTH,
  MAX_MESSAGE_SIZE,
  MessageType,
  Sender,
  splitHeaderContentRest,
} from '../../../src/python-communication/socket-based/protocol';
import { SocketServer } from '../../../src/python-communication/socket-based/Server';

vi.mock('typedi', () => ({
  default: { set: vi.fn(), get: vi.fn(), has: vi.fn() },
  Service: () => (c: unknown) => c,
  Inject: () => () => {},
}));

vi.mock('../../../src/Logging', () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logTrace: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

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
  it('constant HEADER_LENGTH equals 26 bytes', () => {
    expect(HEADER_LENGTH).toBe(26);
  });

  it('constant MAX_MESSAGE_SIZE equals 256 MB', () => {
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

  describe('partial payload — full header but insufficient chunk data', () => {
    it('returns Err when header declares chunkLength=16 but only 4 bytes of payload follow', () => {
      // Build a buffer with 4 bytes of chunk data, then overwrite chunkLength
      // field (offset 22) to declare 16 bytes expected.  The resulting buffer
      // has HEADER_LENGTH + 4 bytes total, so data.length - HEADER_LENGTH (4)
      // < chunkLength (16) → splitHeaderContentRest must return Err.
      const chunkData = Buffer.alloc(4);
      const buf = buildBuffer({
        messageLength: HEADER_LENGTH + 16,
        chunkData,
      });
      // chunkLength field is at offset 22 (sum of preceding field widths)
      buf.writeUInt32BE(16, 22);
      const result = splitHeaderContentRest(buf);
      expect(result.err).toBe(true);
    });
  });
});

describe('socketServer integration — MAX_MESSAGE_SIZE rejection', () => {
  let serverInstance: SocketServer | undefined;

  afterEach(async () => {
    if (serverInstance) {
      const s = serverInstance;
      serverInstance = undefined;
      await new Promise<void>((resolve) => {
        s.server.close(() => resolve());
      });
    }
  });

  it('destroys the client socket when messageLength exceeds MAX_MESSAGE_SIZE', async () => {
    serverInstance = new SocketServer();
    await serverInstance.start();
    const port = serverInstance.portNumber;

    await new Promise<void>((resolve, reject) => {
      const client = new net.Socket();
      const timer = setTimeout(() => reject(new Error('timed out waiting for socket close')), 5000);
      client.connect(port, '127.0.0.1', () => {
        // Send auth token first (required by socket server)
        const secret = Buffer.from(serverInstance!.secretHex, 'hex');
        const buf = buildBuffer({ messageLength: MAX_MESSAGE_SIZE + 1 });
        client.write(Buffer.concat([secret, buf]));
      });
      client.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timer);
        // ECONNRESET is expected when the server destroys the socket
        if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
          resolve();
        }
        else {
          reject(err);
        }
      });
    });
  });

  it('does not invoke the message handler when messageLength exceeds MAX_MESSAGE_SIZE', async () => {
    serverInstance = new SocketServer();
    await serverInstance.start();
    const port = serverInstance.portNumber;

    let handlerCalled = false;
    // requestId in buildBuffer defaults to 42; register a response listener for it
    serverInstance.onResponse(42, () => {
      handlerCalled = true;
    });

    await new Promise<void>((resolve, reject) => {
      const client = new net.Socket();
      const timer = setTimeout(() => reject(new Error('timed out')), 5000);
      client.connect(port, '127.0.0.1', () => {
        // Send auth token first (required by socket server)
        const secret = Buffer.from(serverInstance!.secretHex, 'hex');
        const buf = buildBuffer({ messageLength: MAX_MESSAGE_SIZE + 1 });
        client.write(Buffer.concat([secret, buf]));
      });
      client.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timer);
        if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
          resolve();
        }
        else {
          reject(err);
        }
      });
    });

    expect(handlerCalled).toBe(false);
  });

  it('sends oversized header in two chunks — still rejected once full header arrives', async () => {
    serverInstance = new SocketServer();
    await serverInstance.start();
    const port = serverInstance.portNumber;

    await new Promise<void>((resolve, reject) => {
      const client = new net.Socket();
      const timer = setTimeout(() => reject(new Error('timed out')), 5000);
      client.connect(port, '127.0.0.1', () => {
        // Send auth token first (required by socket server)
        const secret = Buffer.from(serverInstance!.secretHex, 'hex');
        // Send the full header split into two writes: first 4 bytes (messageLength),
        // then the rest.  After the second write the server has >= HEADER_LENGTH
        // bytes and should detect the oversized messageLength and destroy the socket.
        const buf = buildBuffer({ messageLength: MAX_MESSAGE_SIZE + 1 });
        client.write(secret);
        client.write(buf.subarray(0, 4), () => {
          client.write(buf.subarray(4));
        });
      });
      client.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timer);
        if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
          resolve();
        }
        else {
          reject(err);
        }
      });
    });
  });
});
