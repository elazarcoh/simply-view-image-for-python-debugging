import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('typedi', () => ({
  default: { set: vi.fn(), get: vi.fn(() => undefined), has: vi.fn() },
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

describe('savePathHelper — path traversal prevention (S7)', () => {
  const saveDir = '/tmp/svifpd/images/session1';

  async function makeSavePathHelper() {
    const { SavePathHelper } = await import('../../../src/SerializationHelper');
    vi.spyOn(
      SavePathHelper.prototype as unknown as { mkdir: () => unknown },
      'mkdir',
    ).mockReturnValue({ ok: true, val: undefined });
    const helper = Object.create(SavePathHelper.prototype) as InstanceType<typeof SavePathHelper>;
    (helper as unknown as Record<string, string>).saveDir = saveDir;
    return helper;
  }

  describe('sanitization — variable names', () => {
    it('preserves a normal variable name unchanged', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: 'my_var' });
      expect(result).toBe(path.join(saveDir, 'my_var').replace(/\\/g, '/'));
    });

    it('preserves a short simple name', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: 'img' });
      expect(result).toBe(path.join(saveDir, 'img').replace(/\\/g, '/'));
    });

    it('preserves alphanumeric names with underscores and digits', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: 'result_1' });
      expect(result).toBe(path.join(saveDir, 'result_1').replace(/\\/g, '/'));
    });
  });

  describe('path traversal — unix separators', () => {
    it('blocks ../ traversal (stays inside saveDir)', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: '../etc/passwd' });
      expect(result.startsWith(saveDir.replace(/\\/g, '/'))).toBe(true);
    });

    it('blocks ../../ traversal (stays inside saveDir)', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: '../../etc/passwd' });
      expect(result.startsWith(saveDir.replace(/\\/g, '/'))).toBe(true);
    });

    it('does not contain /etc/passwd after sanitizing ../../etc/passwd', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: '../../etc/passwd' });
      expect(result).not.toContain('/etc/passwd');
    });
  });

  describe('path traversal — windows backslash separators', () => {
    it('blocks ..\\  traversal (stays inside saveDir)', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: '..\\etc\\passwd' });
      expect(result.startsWith(saveDir.replace(/\\/g, '/'))).toBe(true);
    });

    it('blocks ..\\..\\ traversal (stays inside saveDir)', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: '..\\..\\ etc\\passwd' });
      expect(result.startsWith(saveDir.replace(/\\/g, '/'))).toBe(true);
    });
  });

  describe('null byte injection', () => {
    it('strips null bytes from variable names', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: 'my_var\x00.txt' });
      expect(result).not.toContain('\x00');
      expect(result.startsWith(saveDir.replace(/\\/g, '/'))).toBe(true);
    });
  });

  describe('integration — savePathFor with variable', () => {
    it('normal variable name produces path.join(saveDir, name)', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: 'my_var' });
      expect(result).toBe(`${saveDir}/my_var`);
    });

    it('traversal variable does not escape saveDir', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ variable: '../../etc/passwd' });
      expect(result.startsWith(saveDir)).toBe(true);
    });

    it('expression objects use a short random id (not variable-based)', async () => {
      const helper = await makeSavePathHelper();
      const result = helper.savePathFor({ expression: '../../etc/passwd' });
      expect(result.startsWith(saveDir.replace(/\\/g, '/'))).toBe(true);
      // Short ids are 6 chars from Math.random().toString(36)
      const relativePart = result.slice(saveDir.length + 1);
      expect(relativePart.length).toBeGreaterThan(0);
      expect(relativePart).not.toContain('/');
    });
  });
});
