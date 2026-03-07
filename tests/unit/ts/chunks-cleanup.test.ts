/**
 * Integration tests for SocketServer chunksByMessageId cleanup (R3).
 *
 * Verifies that completed message chunks are removed from the map so the
 * server does not accumulate unbounded memory over long debug sessions.
 */

import { Buffer } from 'node:buffer';
import * as net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StatefulBufferWriter } from '../../../src/python-communication/socket-based/BufferWriter';
import {
  HEADER_LENGTH,
  MessageType,
  Sender,
} from '../../../src/python-communication/socket-based/protocol';
import { SocketServer } from '../../../src/python-communication/socket-based/Server';

vi.mock('typedi', () => ({ Service: () => (_target: unknown) => _target }));

vi.mock('vscode-extensions-json-generator/utils', () => ({
  configUtils: {
    ConfigurationGetter: () => () => undefined,
    ConfigurationSetter: () => () => undefined,
    ConfigurationInspector: () => () => undefined,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a single wire-frame chunk (header + data). */
function buildChunk(params: {
  messageId: number;
  requestId: number;
  messageLength: number; // total data across all chunks
  chunkCount: number;
  chunkNumber: number;
  data: Buffer;
}): Buffer {
  const { messageId, requestId, messageLength, chunkCount, chunkNumber, data } = params;
  const headerBuf = Buffer.alloc(HEADER_LENGTH);
  const writer = new StatefulBufferWriter(headerBuf);
  writer.writeUInt32(messageLength);
  writer.writeUInt32(messageId);
  writer.writeUInt8(Sender.Python);
  writer.writeUInt32(requestId);
  writer.writeUInt8(MessageType.PythonSendingObject);
  writer.writeUInt32(chunkCount);
  writer.writeUInt32(chunkNumber);
  writer.writeUInt32(data.length);
  return Buffer.concat([headerBuf, data]);
}

/** Send bytes to the server and wait long enough for loopback TCP delivery. */
async function sendAndWait(socket: net.Socket, buf: Buffer): Promise<void> {
  socket.write(buf);
  // A short timer ensures we yield past the I/O poll phase so the server's
  // 'data' handler has time to run before we check the map.
  await new Promise<void>(resolve => setTimeout(resolve, 10));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let server: SocketServer;
let client: net.Socket;
const serverSideConnections: Set<net.Socket> = new Set();

beforeEach(async () => {
  server = new SocketServer();

  // Track every server-side socket so we can destroy them in afterEach.
  server.server.on('connection', (socket: net.Socket) => {
    serverSideConnections.add(socket);
    socket.once('close', () => serverSideConnections.delete(socket));
  });

  await server.start();

  client = await new Promise<net.Socket>((resolve, reject) => {
    const s = net.createConnection({ port: server.portNumber }, () => resolve(s));
    s.once('error', reject);
  });
});

afterEach(async () => {
  client.destroy();
  for (const socket of serverSideConnections) {
    socket.destroy();
  }
  serverSideConnections.clear();
  await new Promise<void>(resolve => server.server.close(() => resolve()));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socketServer — chunksByMessageId cleanup', () => {
  it('starts with zero pending chunks', () => {
    expect(server.pendingChunkCount).toBe(0);
  });

  it('returns to 0 after a complete single-chunk message', async () => {
    const data = Buffer.from('hello');
    const chunk = buildChunk({
      messageId: 1,
      requestId: 99,
      messageLength: data.length,
      chunkCount: 1,
      chunkNumber: 0,
      data,
    });
    await sendAndWait(client, chunk);
    expect(server.pendingChunkCount).toBe(0);
  });

  it('is 1 while a multi-chunk message is incomplete', async () => {
    const part1 = Buffer.from('abc');
    const part2 = Buffer.from('def');
    const messageLength = part1.length + part2.length;

    const chunk1 = buildChunk({
      messageId: 2,
      requestId: 99,
      messageLength,
      chunkCount: 2,
      chunkNumber: 0,
      data: part1,
    });
    await sendAndWait(client, chunk1);
    expect(server.pendingChunkCount).toBe(1);

    // send the completing chunk
    const chunk2 = buildChunk({
      messageId: 2,
      requestId: 99,
      messageLength,
      chunkCount: 2,
      chunkNumber: 1,
      data: part2,
    });
    await sendAndWait(client, chunk2);
    expect(server.pendingChunkCount).toBe(0);
  });

  it('is 0 after N complete multi-chunk messages (not N × chunkCount)', async () => {
    const N = 5;
    for (let i = 0; i < N; i++) {
      const parts = [Buffer.from('aa'), Buffer.from('bb'), Buffer.from('cc')];
      const messageLength = parts.reduce((s, p) => s + p.length, 0);
      for (let j = 0; j < parts.length; j++) {
        const chunk = buildChunk({
          messageId: 100 + i,
          requestId: 1,
          messageLength,
          chunkCount: parts.length,
          chunkNumber: j,
          data: parts[j],
        });
        await sendAndWait(client, chunk);
      }
    }
    expect(server.pendingChunkCount).toBe(0);
  });

  it('stress: 100 complete single-chunk messages leave pendingChunkCount at 0', async () => {
    for (let i = 0; i < 100; i++) {
      const data = Buffer.from(`message-${i}`);
      const chunk = buildChunk({
        messageId: 200 + i,
        requestId: 1,
        messageLength: data.length,
        chunkCount: 1,
        chunkNumber: 0,
        data,
      });
      await sendAndWait(client, chunk);
    }
    expect(server.pendingChunkCount).toBe(0);
  });
});
