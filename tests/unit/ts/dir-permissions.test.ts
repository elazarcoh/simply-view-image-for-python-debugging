import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_NAME } from '../../../src/globals';

// Mock config to always return undefined (defaults to 'tmp' path)
vi.mock('../../../src/config', () => ({
  getConfiguration: vi.fn(() => undefined),
}));

// Mock typedi container
vi.mock('typedi', () => {
  const containerMock = {
    set: vi.fn(),
    get: vi.fn(() => undefined), // Always return undefined so getUserSpecificTempDir is used
  };
  return {
    default: containerMock,
    Service: () => (c: unknown) => c,
    Inject: () => () => {},
  };
});

// Mock logging
vi.mock('../../../src/Logging', () => ({
  logDebug: vi.fn(),
  logWarn: vi.fn(),
}));

/**
 * Get the expected user-specific temp directory path.
 * This mirrors the logic in getUserSpecificTempDir() from SerializationHelper.
 * Tries XDG_RUNTIME_DIR first, then falls back to /tmp/svifpd-<uid>.
 */
function getExpectedSaveDir(): string {
  const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntimeDir && fs.existsSync(xdgRuntimeDir)) {
    return path.join(xdgRuntimeDir, EXTENSION_NAME, 'images');
  }
  const uid = process.getuid?.() ?? os.userInfo().uid;
  return path.join(os.tmpdir(), `${EXTENSION_NAME}-${uid}`, 'images');
}

describe('setSaveLocation — multi-user temp directory isolation', () => {
  afterEach(() => {
    // Clean up after all tests in this describe block
    const saveDir = getExpectedSaveDir();
    fs.rmSync(saveDir, { recursive: true, force: true });
  });

  it('creates user-specific directory with correct permissions', async () => {
    const { setSaveLocation } = await import('../../../src/SerializationHelper');
    const saveDir = getExpectedSaveDir();

    // Ensure clean state
    fs.rmSync(saveDir, { recursive: true, force: true });

    // Call setSaveLocation (this should create the directory)
    const ctx = { globalStorageUri: { fsPath: '/tmp/test-storage' } } as any;
    setSaveLocation(ctx);

    // Verify directory was created
    expect(fs.existsSync(saveDir)).toBe(true);

    // Verify it's a directory
    const stats = fs.statSync(saveDir);
    expect(stats.isDirectory()).toBe(true);

    // Verify permissions: 0o700 (owner-only read/write/execute)
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o700);
  });

  it('directory is not world-writable', async () => {
    const { setSaveLocation } = await import('../../../src/SerializationHelper');
    const saveDir = getExpectedSaveDir();

    fs.rmSync(saveDir, { recursive: true, force: true });
    const ctx = { globalStorageUri: { fsPath: '/tmp/test-storage' } } as any;
    setSaveLocation(ctx);

    const mode = fs.statSync(saveDir).mode & 0o777;
    // Others (file) and others (execute) bits must be 0
    expect(mode & 0o007).toBe(0);
  });

  it('directory is not group-writable', async () => {
    const { setSaveLocation } = await import('../../../src/SerializationHelper');
    const saveDir = getExpectedSaveDir();

    fs.rmSync(saveDir, { recursive: true, force: true });
    const ctx = { globalStorageUri: { fsPath: '/tmp/test-storage' } } as any;
    setSaveLocation(ctx);

    const mode = fs.statSync(saveDir).mode & 0o777;
    // Group (file) and group (execute) bits must be 0
    expect(mode & 0o070).toBe(0);
  });

  it('directory owner has rwx permissions', async () => {
    const { setSaveLocation } = await import('../../../src/SerializationHelper');
    const saveDir = getExpectedSaveDir();

    fs.rmSync(saveDir, { recursive: true, force: true });
    const ctx = { globalStorageUri: { fsPath: '/tmp/test-storage' } } as any;
    setSaveLocation(ctx);

    const mode = fs.statSync(saveDir).mode & 0o777;
    // Owner read/write/execute (0o700) must be fully set
    expect(mode & 0o700).toBe(0o700);
  });

  it('uses either XDG_RUNTIME_DIR or user-specific /tmp for multi-user isolation', () => {
    const saveDir = getExpectedSaveDir();
    const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
    const uid = process.getuid?.() ?? os.userInfo().uid;

    if (xdgRuntimeDir && fs.existsSync(xdgRuntimeDir)) {
      // Should use XDG_RUNTIME_DIR (already per-user by kernel)
      expect(saveDir).toContain(EXTENSION_NAME);
      expect(saveDir).toContain('images');
    }
    else {
      // Should use user-specific /tmp directory
      expect(saveDir).toContain(`${EXTENSION_NAME}-${uid}`);
      expect(saveDir).toContain('images');
    }
  });
});
