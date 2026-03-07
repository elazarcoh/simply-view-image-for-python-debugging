import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_NAME } from '../../../src/globals';

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

describe('setSaveLocation — temp directory permissions', () => {
  const saveDir = path.join(os.tmpdir(), EXTENSION_NAME, 'images');

  beforeEach(() => {
    // Remove the directory so setSaveLocation will re-create it and apply chmod.
    fs.rmSync(saveDir, { recursive: true, force: true });
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(saveDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function callSetSaveLocation() {
    const { setSaveLocation } = await import('../../../src/SerializationHelper');
    // The 'tmp' code path never accesses context, so an empty stub is sufficient.
    const ctx = {} as import('vscode').ExtensionContext;
    setSaveLocation(ctx);
    return saveDir;
  }

  it('creates temp directory with mode 0o700 (not 0o777)', async () => {
    const dir = await callSetSaveLocation();
    const mode = fs.statSync(dir).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  it('directory is not world-writable (others-write bit is clear)', async () => {
    const dir = await callSetSaveLocation();
    const mode = fs.statSync(dir).mode & 0o777;
    expect(mode & 0o007).toBe(0);
  });

  it('directory owner has read, write and execute permissions', async () => {
    const dir = await callSetSaveLocation();
    const mode = fs.statSync(dir).mode & 0o777;
    expect(mode & 0o700).toBe(0o700);
  });
});
