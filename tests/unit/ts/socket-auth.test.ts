import { Buffer } from 'node:buffer';
import * as net from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('typedi', () => ({
  default: { set: vi.fn(), get: vi.fn(), has: vi.fn() },
  Service: () => (c: unknown) => c,
  Inject: () => () => {},
}));

vi.mock('vscode-extensions-json-generator/utils', () => ({
  configUtils: {
    ConfigurationGetter: () => () => ({}),
  },
}));

const { SocketServer } = await import('../../../src/python-communication/socket-based/Server');
const { AUTH_SECRET_LENGTH } = await import('../../../src/python-communication/socket-based/protocol');

describe('socketServer — shared secret authentication (S4)', () => {
  describe('secretHex property', () => {
    it('is a non-empty string', () => {
      const server = new SocketServer();
      expect(server.secretHex).toBeTruthy();
      expect(typeof server.secretHex).toBe('string');
    });

    it('has length AUTH_SECRET_LENGTH * 2', () => {
      const server = new SocketServer();
      expect(server.secretHex).toHaveLength(AUTH_SECRET_LENGTH * 2);
    });

    it('contains only valid lowercase hex characters', () => {
      const server = new SocketServer();
      expect(server.secretHex).toMatch(/^[0-9a-f]+$/);
    });

    it('different SocketServer instances have different secrets', () => {
      const a = new SocketServer();
      const b = new SocketServer();
      expect(a.secretHex).not.toBe(b.secretHex);
    });
  });

  describe('integration — connection auth', () => {
    let server: InstanceType<typeof SocketServer>;

    beforeEach(async () => {
      server = new SocketServer();
      await server.start();
    });

    afterEach(() => {
      server.server.close();
    });

    it('rejects connection with wrong secret (socket is destroyed)', async () => {
      const wrongSecret = Buffer.alloc(AUTH_SECRET_LENGTH, 0xAB);
      const correctSecret = Buffer.from(server.secretHex, 'hex');
      // Confirm they differ
      expect(wrongSecret.equals(correctSecret)).toBe(false);

      await new Promise<void>((resolve, reject) => {
        const client = net.connect(server.portNumber, 'localhost', () => {
          client.write(wrongSecret);
        });
        const timeout = setTimeout(() => {
          client.destroy();
          reject(new Error('Timeout: socket was not closed after bad auth'));
        }, 3000);
        client.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
        client.on('error', () => {
          clearTimeout(timeout);
          resolve(); // destroyed = error or close, both count
        });
      });
    });

    it('accepts connection with correct secret', async () => {
      const secret = Buffer.from(server.secretHex, 'hex');

      await new Promise<void>((resolve, reject) => {
        const client = net.connect(server.portNumber, 'localhost', () => {
          client.write(secret);
          // Give the server a moment to process auth, then verify socket is still open
          setTimeout(() => {
            if (!client.destroyed) {
              client.destroy();
              resolve();
            }
            else {
              reject(new Error('Socket was destroyed after correct secret'));
            }
          }, 200);
        });
        client.on('error', (err) => {
          reject(err);
        });
      });
    });
  });
});
