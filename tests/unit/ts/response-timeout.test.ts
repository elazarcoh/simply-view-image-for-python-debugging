/**
 * Tests for SocketServer.onResponse timeout (R4).
 *
 * Bug: onResponse() subscribed a callback that would never fire if the Python
 * side crashed or disconnected, leaving the promise hanging forever and the
 * request subscription leaked.
 *
 * Fix: a 30-second timeout unsubscribes the pending request and calls the
 * optional onTimeout handler.
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
import { RESPONSE_TIMEOUT_MS, SocketServer } from '../../../src/python-communication/socket-based/Server';

vi.mock('typedi', () => ({
  default: { set: vi.fn(), get: vi.fn(), has: vi.fn() },
  Service: () => (c: unknown) => c,
  Inject: () => () => {},
}));

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

function buildChunk(params: {
  messageId: number;
  requestId: number;
  messageLength: number;
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

// ---------------------------------------------------------------------------
// Unit tests — fake timers
// ---------------------------------------------------------------------------

describe('socketServer.onResponse — timeout (unit, fake timers)', () => {
  let server: SocketServer;

  beforeEach(() => {
    vi.useFakeTimers();
    server = new SocketServer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with zero pending responses', () => {
    expect(server.pendingResponseCount).toBe(0);
  });

  it('registers one pending response after onResponse is called', () => {
    server.onResponse(42, vi.fn());
    expect(server.pendingResponseCount).toBe(1);
  });

  it('fires onTimeout and cleans up the callback after timeout', () => {
    const onTimeout = vi.fn();
    server.onResponse(42, vi.fn(), onTimeout);

    expect(server.pendingResponseCount).toBe(1);

    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS);

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(server.pendingResponseCount).toBe(0);
  });

  it('does not fire onTimeout when response arrives before timeout', () => {
    const onTimeout = vi.fn();
    const callback = vi.fn();
    server.onResponse(42, callback, onTimeout);

    // simulate the server receiving a data event from Python
    server.simulateIncomingData(
      { requestId: 42, messageID: 1, messageLength: 2, sender: Sender.Python, messageType: MessageType.PythonSendingObject, chunkCount: 1, chunkNumber: 0, chunkLength: 2 },
      Buffer.from('ok'),
    );

    expect(callback).toHaveBeenCalledOnce();
    expect(server.pendingResponseCount).toBe(0);

    // advance past the original timeout — onTimeout must NOT fire
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS + 1000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('cleans up pending callback after successful response (no memory leak)', () => {
    server.onResponse(7, vi.fn(), vi.fn());
    expect(server.pendingResponseCount).toBe(1);

    server.simulateIncomingData(
      { requestId: 7, messageID: 1, messageLength: 2, sender: Sender.Python, messageType: MessageType.PythonSendingObject, chunkCount: 1, chunkNumber: 0, chunkLength: 2 },
      Buffer.from('hi'),
    );

    expect(server.pendingResponseCount).toBe(0);
  });

  it('callback is not called after timeout fires', () => {
    const callback = vi.fn();
    server.onResponse(99, callback);

    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS);

    // attempt to deliver data after the timeout — should be ignored
    server.simulateIncomingData(
      { requestId: 99, messageID: 1, messageLength: 2, sender: Sender.Python, messageType: MessageType.PythonSendingObject, chunkCount: 1, chunkNumber: 0, chunkLength: 2 },
      Buffer.from('late'),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Integration test — real server, real timers
// ---------------------------------------------------------------------------

describe('socketServer.onResponse — integration (real server)', () => {
  let server: SocketServer;
  const clients: net.Socket[] = [];
  const serverSideConnections = new Set<net.Socket>();

  async function connectClient(port: number, serverSecret: string): Promise<net.Socket> {
    const client = net.createConnection({ port });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => {
        // Send auth token first (required by socket server)
        const secret = Buffer.from(serverSecret, 'hex');
        client.write(secret);
        resolve();
      });
      client.once('error', reject);
    });
    return client;
  }

  beforeEach(async () => {
    server = new SocketServer();
    server.server.on('connection', (socket: net.Socket) => {
      serverSideConnections.add(socket);
      socket.once('close', () => serverSideConnections.delete(socket));
    });
    await server.start();
  });

  afterEach(async () => {
    for (const c of clients.splice(0)) {
      c.destroy();
    }
    for (const s of serverSideConnections) {
      s.destroy();
    }
    serverSideConnections.clear();
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('server.close() timed out')), 2000);
      server.server.close(() => {
        clearTimeout(t);
        resolve();
      });
    });
  });

  it('resolves callback when Python sends a real response over the socket', async () => {
    const requestId = 1;
    const payload = Buffer.from('hello from python');

    const chunk = buildChunk({
      messageId: 1,
      requestId,
      messageLength: payload.length,
      chunkCount: 1,
      chunkNumber: 0,
      data: payload,
    });

    const responsePromise = new Promise<Buffer>((resolve) => {
      server.onResponse(requestId, (_header, data) => resolve(data));
    });

    const client = await connectClient(server.portNumber, server.secretHex);
    client.write(chunk);

    const received = await responsePromise;
    expect(received).toEqual(payload);
    expect(server.pendingResponseCount).toBe(0);
  });

  it('starts with zero pending responses', () => {
    expect(server.pendingResponseCount).toBe(0);
  });
});
