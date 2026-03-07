import type { Result } from '../../../src/utils/Result';
import { parsePythonResult } from '../../../src/python-communication/PythonValueParser';

// parsePythonResult returns Result<T>; when T = Result<V>, the outer Ok wraps
// the inner ValidPythonResult (Ok for Value(...), Err for Error(...)).
type PR<V = string> = Result<Result<V>>;

describe('parsePythonResult — escaped strings', () => {
  it('parses a plain single-quoted string', () => {
    const result = parsePythonResult<Result<string>>('Value(\'hello\')') as PR;
    expect(result.ok).toBe(true);
    if (!result.ok)
      return;
    expect(result.val.ok).toBe(true);
    if (!result.val.ok)
      return;
    expect(result.val.val).toBe('hello');
  });

  it('parses a string containing escaped double quotes (bug fix)', () => {
    // Python: sanitize('hello "world"') → 'hello \\"world\\"'
    // stringify wraps: '"hello \\"world\\""'
    // Wire format:  Value("hello \"world\"")
    // JS literal:   'Value("hello \\"world\\"")'
    const result = parsePythonResult<Result<string>>('Value("hello \\"world\\"")') as PR;
    expect(result.ok).toBe(true);
    if (!result.ok)
      return;
    expect(result.val.ok).toBe(true);
    if (!result.val.ok)
      return;
    expect(result.val.val).toBe('hello "world"');
  });

  it('parses a string with an escaped backslash', () => {
    // Python: sanitize('path\\to') → 'path\\\\to'
    // Wire format:  Value("path\\to")
    // JS literal:   'Value("path\\\\to")'
    const result = parsePythonResult<Result<string>>('Value("path\\\\to")') as PR;
    expect(result.ok).toBe(true);
    if (!result.ok)
      return;
    expect(result.val.ok).toBe(true);
    if (!result.val.ok)
      return;
    expect(result.val.val).toBe('path\\to');
  });

  it('parses a string with multiple escaped double quotes', () => {
    // Wire format:  Value("say \"hi\" and \"bye\"")
    const result = parsePythonResult<Result<string>>('Value("say \\"hi\\" and \\"bye\\"")') as PR;
    expect(result.ok).toBe(true);
    if (!result.ok)
      return;
    expect(result.val.ok).toBe(true);
    if (!result.val.ok)
      return;
    expect(result.val.val).toBe('say "hi" and "bye"');
  });

  it('parses a string with both backslash and double quote', () => {
    // Python: sanitize('C:\\path "to"') → 'C:\\\\path \\"to\\"'
    // stringify wraps in double quotes: "C:\\path \"to\""
    // Wire format:  Value("C:\\path \"to\"")
    // JS literal:   'Value("C:\\\\path \\"to\\"")'
    const result = parsePythonResult<Result<string>>('Value("C:\\\\path \\"to\\"")') as PR;
    expect(result.ok).toBe(true);
    if (!result.ok)
      return;
    expect(result.val.ok).toBe(true);
    if (!result.val.ok)
      return;
    expect(result.val.val).toBe('C:\\path "to"');
  });

  it('still parses a plain string without escapes correctly', () => {
    const result = parsePythonResult<Result<string>>('Value(\'world\')') as PR;
    expect(result.ok).toBe(true);
    if (!result.ok)
      return;
    expect(result.val.ok).toBe(true);
    if (!result.val.ok)
      return;
    expect(result.val.val).toBe('world');
  });

  describe('stripReprQuoting: outer Python repr-quoting is stripped', () => {
    it('strips outer single quotes and parses the inner expression', () => {
      // Python repr('Value(42)') → "'Value(42)'"
      const result = parsePythonResult<Result<number>>('\'Value(42)\'') as Result<Result<number>>;
      expect(result.ok).toBe(true);
      if (!result.ok)
        return;
      expect(result.val.ok).toBe(true);
      if (!result.val.ok)
        return;
      expect(result.val.val).toBe(42);
    });

    it('strips outer double quotes and parses inner single-quoted string', () => {
      // Outer double-quoted repr of Value('hello'): "Value('hello')"
      const result = parsePythonResult<Result<string>>('"Value(\'hello\')"') as PR;
      expect(result.ok).toBe(true);
      if (!result.ok)
        return;
      expect(result.val.ok).toBe(true);
      if (!result.val.ok)
        return;
      expect(result.val.val).toBe('hello');
    });
  });

  describe('integration: roundtrip with Python sanitize output', () => {
    it('parses an empty string', () => {
      const result = parsePythonResult<Result<string>>('Value("")') as PR;
      expect(result.ok).toBe(true);
      if (!result.ok)
        return;
      expect(result.val.ok).toBe(true);
      if (!result.val.ok)
        return;
      expect(result.val.val).toBe('');
    });

    it('parses an Error response', () => {
      const result = parsePythonResult<Result<string>>('Error("something went wrong")') as Result<Result<string>>;
      expect(result.ok).toBe(true);
      if (!result.ok)
        return;
      expect(result.val.ok).toBe(false);
      if (result.val.ok)
        return;
      expect(result.val.val).toBe('something went wrong');
    });
  });
});
