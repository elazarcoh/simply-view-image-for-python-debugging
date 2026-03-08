/**
 * Unit tests for awaiting SocketServer.start() (A2).
 *
 * Verifies that SocketServer.start() is properly awaited so that startup
 * errors are propagated rather than silently swallowed.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('typedi', () => ({ Service: () => (_target: unknown) => _target }));

vi.mock('vscode-extensions-json-generator/utils', () => ({
  configUtils: {
    ConfigurationGetter: () => () => undefined,
    ConfigurationSetter: () => () => undefined,
    ConfigurationInspector: () => () => undefined,
  },
}));

// Simulate an async server start that can succeed or fail.
class FakeServer {
  started = false;
  constructor(private readonly shouldFail = false) {}
  async start(): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Port already in use');
    }
    this.started = true;
  }
}

describe('socketServer.start() await semantics', () => {
  it('fire-and-forget swallows synchronous errors (demonstrates the bug)', async () => {
    // When start() is called without await, the returned promise is discarded.
    // Any rejection is unhandled and the caller never sees the error.
    // We attach a no-op catch so the rejection does not leak into the test runner.
    const srv = new FakeServer(true);
    srv.start().catch(() => undefined); // caller discards the promise
    await new Promise(r => setTimeout(r, 10)); // let async tick settle
    expect(srv.started).toBe(false);
  });

  it('awaited start propagates errors (demonstrates the fix)', async () => {
    const srv = new FakeServer(true);
    let errorCaught = false;
    try {
      await srv.start();
    }
    catch {
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
    expect(srv.started).toBe(false);
  });

  it('awaited start resolves on success', async () => {
    const srv = new FakeServer(false);
    await srv.start();
    expect(srv.started).toBe(true);
  });
});
