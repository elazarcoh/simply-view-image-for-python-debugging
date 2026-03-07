/**
 * Unit tests for PythonValueParser (T1).
 *
 * parsePythonResult(input) expects a quote-wrapped string that the Python
 * helper eval_into_value() / eval_or_return_exception() produces, e.g.:
 *   'Value(42)'   "Error("RuntimeError: boom")"
 *
 * Return shape: Ok(innerResult) on parse success, Err(msg) on parse failure.
 *   innerResult.ok === true  → Value(...) wrapper → innerResult.val is the JS value
 *   innerResult.ok === false → Error(...) wrapper → innerResult.val is the error string
 */

import type { Err, Ok } from 'ts-results';
import { parsePythonResult } from '../../../src/python-communication/PythonValueParser';

// Helper: unwrap a successfully-parsed result two levels deep.
function unwrapValue(input: string): unknown {
  const outer = parsePythonResult(input);
  expect(outer.ok).toBe(true);
  const inner = (outer as Ok<unknown>).val as Ok<unknown>;
  expect(inner.ok).toBe(true);
  return inner.val;
}

// Helper: unwrap a successfully-parsed Error(...) wrapper.
function unwrapError(input: string): unknown {
  const outer = parsePythonResult(input);
  expect(outer.ok).toBe(true);
  const inner = (outer as Ok<unknown>).val as Err<unknown>;
  expect(inner.ok).toBe(false);
  return inner.val;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
describe('primitives', () => {
  it('parses an integer', () => {
    expect(unwrapValue('\'Value(42)\'')).toBe(42);
  });

  it('parses zero', () => {
    expect(unwrapValue('\'Value(0)\'')).toBe(0);
  });

  it('parses a float serialised by stringify() as a string value', () => {
    // Python stringify() calls str(value) for floats → produces "3.14" (double-quoted).
    // The parser reads it as the JS string "3.14" — not a JS number.
    const val = unwrapValue(`'Value("3.14")'`);
    expect(val).toBe('3.14');
  });

  it('parses True as true', () => {
    expect(unwrapValue('\'Value(True)\'')).toBe(true);
  });

  it('parses False as false', () => {
    expect(unwrapValue('\'Value(False)\'')).toBe(false);
  });

  it('parses None as null', () => {
    expect(unwrapValue('\'Value(None)\'')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------
describe('strings', () => {
  it('parses a single-quoted string', () => {
    expect(unwrapValue(`'Value('hello')'`)).toBe('hello');
  });

  it('parses a double-quoted string', () => {
    expect(unwrapValue(`'Value("world")'`)).toBe('world');
  });

  it('parses an empty string', () => {
    expect(unwrapValue(`'Value("")'`)).toBe('');
  });

  it('parses a string with spaces', () => {
    expect(unwrapValue(`'Value("hello world")'`)).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
describe('collections', () => {
  it('parses an empty list', () => {
    expect(unwrapValue('\'Value([])\'')).toEqual([]);
  });

  it('parses a list of integers', () => {
    expect(unwrapValue('\'Value([1,2,3])\'')).toEqual([1, 2, 3]);
  });

  it('parses list with spaces after commas', () => {
    // Python repr uses spaces: [1, 2, 3] not [1,2,3]
    expect(unwrapValue('\'Value([1, 2, 3])\'')).toEqual([1, 2, 3]);
  });

  it('parses a list of strings', () => {
    expect(unwrapValue(`'Value(["a","b","c"])'`)).toEqual(['a', 'b', 'c']);
  });

  it('parses a nested list', () => {
    expect(unwrapValue('\'Value([[1,2],[3,4]])\'')).toEqual([[1, 2], [3, 4]]);
  });

  it('parses a tuple as an array', () => {
    expect(unwrapValue('\'Value((1,2))\'')).toEqual([1, 2]);
  });

  it('parses a dict with string keys', () => {
    expect(unwrapValue(`'Value({"key": 1})'`)).toEqual({ key: 1 });
  });

  it('parses a dict with multiple entries', () => {
    expect(unwrapValue(`'Value({"a": 1, "b": 2})'`)).toEqual({ a: 1, b: 2 });
  });
});

// ---------------------------------------------------------------------------
// Error wrapper
// ---------------------------------------------------------------------------
describe('error wrapper', () => {
  it('parses Error(...) to ok===false with the error string', () => {
    const errVal = unwrapError(`'Error("RuntimeError: boom")'`);
    expect(errVal).toBe('RuntimeError: boom');
  });

  it('parses Error with single-quoted message', () => {
    const errVal = unwrapError(`'Error('oops')'`);
    expect(errVal).toBe('oops');
  });
});

// ---------------------------------------------------------------------------
// Invalid input
// ---------------------------------------------------------------------------
describe('invalid input', () => {
  it('returns ok===false for a garbage string', () => {
    const result = parsePythonResult('not valid python at all');
    expect(result.ok).toBe(false);
  });

  it('returns ok===false for an empty string', () => {
    const result = parsePythonResult('');
    expect(result.ok).toBe(false);
  });

  it('returns ok===false for a bare number (no Value wrapper, no outer quote)', () => {
    const result = parsePythonResult('42');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: strings that Python's stringify() / eval_into_value() produce
// ---------------------------------------------------------------------------
// These strings are the exact format that the Python helper in
// src/python/common.py generates and that the extension receives from DAP
// evaluate or the Jupyter kernel.  They document the Python↔TS format
// contract.
describe('integration – Python stringify() format contract', () => {
  // Python: eval_into_value(lambda: {'width': 640, 'height': 480, 'channels': 'RGB'})
  //       → "Value({"width": 640, "height": 480, "channels": "RGB"})"
  it('shape dict from DAP repr', () => {
    expect(unwrapValue(`'Value({"width": 640, "height": 480, "channels": "RGB"})'`))
      .toEqual({ width: 640, height: 480, channels: 'RGB' });
  });

  // Python: same_value_multiple_callables(get_value, funcs) returns a Python list
  //       ['Value(1)', 'Value(2)'].  runPythonCode wraps the call with stringify(),
  //       so the actual evaluated expression is stringify([...]), which — because
  //       each element already starts with "Value(" — produces the unquoted string
  //       [Value(1),Value(2)].  DAP repr-wraps that string with outer quotes →
  //       '[Value(1),Value(2)]'.
  it('list of results (multiple callables output)', () => {
    const outer = parsePythonResult(`'[Value(1),Value(2)]'`);
    expect(outer.ok).toBe(true);
    const list = (outer as Ok<unknown>).val as Array<Ok<unknown>>;
    expect(list).toHaveLength(2);
    expect(list[0].ok).toBe(true);
    expect((list[0] as Ok<unknown>).val).toBe(1);
    expect(list[1].ok).toBe(true);
    expect((list[1] as Ok<unknown>).val).toBe(2);
  });

  // Grammar's ValidPythonResult has a bare-None branch (used when None appears
  // directly in a multi-result list, not inside a Value() wrapper).
  it('bare None (without Value wrapper) parses correctly', () => {
    // Grammar: ValidPythonResult → None → Ok(null)
    const outer = parsePythonResult(`'None'`);
    expect(outer.ok).toBe(true);
    const inner = (outer as Ok<unknown>).val as Ok<null>;
    expect(inner.ok).toBe(true);
    expect(inner.val).toBeNull();
  });
});
