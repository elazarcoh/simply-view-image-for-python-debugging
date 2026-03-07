import { describe, expect, it, vi } from 'vitest';

import { asPythonValue } from '../../../src/python-communication/BuildPythonCode';

vi.mock('typedi', () => ({
  default: { set: vi.fn(), get: vi.fn(), has: vi.fn() },
  Service: () => (c: unknown) => c,
  Inject: () => () => {},
}));

vi.mock('../../../src/AllViewables', () => ({
  AllViewables: class {
    allViewables = [];
  },
}));

describe('asPythonValue', () => {
  it('wraps a plain string in single quotes', () => {
    expect(asPythonValue('hello')).toBe('\'hello\'');
  });

  it('escapes a single quote inside a string', () => {
    expect(asPythonValue('it\'s')).toBe('\'it\\\'s\'');
  });

  it('escapes a backslash inside a string', () => {
    expect(asPythonValue('path\\to')).toBe('\'path\\\\to\'');
  });

  it('escapes backslash before single quote (both present)', () => {
    // Input: it\'s  (backslash then quote)
    // Backslash → \\\\ then quote → \\'  → 'it\\\\'s'
    expect(asPythonValue('it\\\'s')).toBe('\'it\\\\\\\'s\'');
  });

  it('handles an empty string', () => {
    expect(asPythonValue('')).toBe('\'\'');
  });

  it('handles numbers as bare numeric literals', () => {
    expect(asPythonValue(42)).toBe('42');
    expect(asPythonValue(3.14)).toBe('3.14');
  });

  it('handles booleans as Python True/False', () => {
    expect(asPythonValue(true)).toBe('True');
    expect(asPythonValue(false)).toBe('False');
  });

  it('handles null as Python None', () => {
    expect(asPythonValue(null)).toBe('None');
  });

  it('produces output that contains no unmatched single quotes', () => {
    // The result must start and end with a single quote, with all interior
    // single quotes preceded by a backslash.
    const result = asPythonValue('it\'s a test with a \\ backslash');
    expect(result.startsWith('\'')).toBe(true);
    expect(result.endsWith('\'')).toBe(true);
    // Remove escaped quotes (\') and escaped backslashes (\\), the remainder
    // should have no bare single quotes.
    const interior = result.slice(1, -1);
    const withoutEscapedPairs = interior.replace(/\\./g, '');
    expect(withoutEscapedPairs).not.toContain('\'');
  });
});
