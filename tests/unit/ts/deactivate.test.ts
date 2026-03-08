/**
 * Unit tests for SocketServer.close() (A1).
 *
 * Verifies that the SocketServer can be started, stopped, and that
 * close() is idempotent and safe to call on a never-started server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SocketServer } from '../../../src/python-communication/socket-based/Server';

vi.mock('typedi', () => ({ Service: () => (_target: unknown) => _target }));

vi.mock('vscode-extensions-json-generator/utils', () => ({
  configUtils: {
    ConfigurationGetter: () => () => undefined,
    ConfigurationSetter: () => () => undefined,
    ConfigurationInspector: () => () => undefined,
  },
}));

let server: SocketServer;

beforeEach(() => {
  server = new SocketServer();
});

afterEach(async () => {
  server.close();
  // Give close() time to finish
  await new Promise<void>(resolve => setTimeout(resolve, 10));
});

describe('socketServer.close()', () => {
  it('server starts and listens', async () => {
    await server.start();
    expect(server.isListening).toBe(true);
  });

  it('close() stops listening', async () => {
    await server.start();
    expect(server.isListening).toBe(true);
    server.close();
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    expect(server.isListening).toBe(false);
  });

  it('close() is idempotent', async () => {
    await server.start();
    expect(() => {
      server.close();
      server.close();
    }).not.toThrow();
  });

  it('close() on never-started server is safe', () => {
    expect(() => server.close()).not.toThrow();
  });
});
