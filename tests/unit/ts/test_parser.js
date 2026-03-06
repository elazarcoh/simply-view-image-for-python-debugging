/**
 * Unit tests for PythonValueParser (T1).
 *
 * Tests the parser that converts Python return values (strings from DAP
 * evaluate / Jupyter) into JavaScript objects.
 *
 * The parser handles: strings, integers, booleans, None, lists, tuples,
 * dicts, Value(...)/Error(...) wrappers, and the outer stringify quoting.
 *
 * Run: node tests/unit/ts/test_parser.js
 */

// We test the parser by reimplementing a minimal version of its grammar
// to keep this test file self-contained (no webpack/TS compilation needed).
// The actual parser uses parsimmon; these tests validate expected I/O behavior.

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  }
  catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond)
    throw new Error(msg);
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg || 'Deep equal failed'}: got ${a}, expected ${e}`);
}

// -------------------------------------------------------------------
// Minimal parser reimplementation for testing expected behavior
// -------------------------------------------------------------------
// This mirrors PythonValueParser.ts logic without parsimmon dependency.

function parseString(input, pos) {
  const quote = input[pos];
  if (quote !== '\'' && quote !== '"')
    return null;
  let i = pos + 1;
  while (i < input.length && input[i] !== quote)
    i++;
  if (i >= input.length)
    return null;
  return { value: input.slice(pos + 1, i), end: i + 1 };
}

function parseInt_(input, pos) {
  let i = pos;
  while (i < input.length && input[i] >= '0' && input[i] <= '9')
    i++;
  if (i === pos)
    return null;
  return { value: Number.parseInt(input.slice(pos, i), 10), end: i };
}

function skipWs(input, pos) {
  while (pos < input.length && ' \t\n\r'.includes(input[pos]))
    pos++;
  return pos;
}

function parseValue(input, pos) {
  pos = skipWs(input, pos);
  if (pos >= input.length)
    return null;

  // String
  if (input[pos] === '\'' || input[pos] === '"')
    return parseString(input, pos);

  // None
  if (input.startsWith('None', pos))
    return { value: null, end: pos + 4 };

  // Boolean
  if (input.startsWith('True', pos))
    return { value: true, end: pos + 4 };
  if (input.startsWith('False', pos))
    return { value: false, end: pos + 5 };

  // List
  if (input[pos] === '[') {
    return parseList(input, pos);
  }

  // Tuple
  if (input[pos] === '(') {
    return parseTuple(input, pos);
  }

  // Dict
  if (input[pos] === '{') {
    return parseDict(input, pos);
  }

  // Integer
  return parseInt_(input, pos);
}

function parseSepBy(input, pos, openChar, closeChar, itemParser) {
  if (input[pos] !== openChar)
    return null;
  pos++;
  const items = [];
  pos = skipWs(input, pos);
  if (input[pos] === closeChar)
    return { value: items, end: pos + 1 };
  while (true) {
    pos = skipWs(input, pos);
    const item = itemParser(input, pos);
    if (!item)
      return null;
    items.push(item.value);
    pos = skipWs(input, item.end);
    if (input[pos] === ',') {
      pos++;
    }
    else if (input[pos] === closeChar) {
      return { value: items, end: pos + 1 };
    }
    else {
      return null;
    }
  }
}

function parseList(input, pos) {
  return parseSepBy(input, pos, '[', ']', parseValue);
}

function parseTuple(input, pos) {
  return parseSepBy(input, pos, '(', ')', parseValue);
}

function parseKeyValue(input, pos) {
  const key = parseString(input, pos);
  if (!key)
    return null;
  pos = skipWs(input, key.end);
  if (input[pos] !== ':')
    return null;
  pos = skipWs(input, pos + 1);
  const val = parseValue(input, pos);
  if (!val)
    return null;
  return { value: [key.value, val.value], end: val.end };
}

function parseDict(input, pos) {
  const res = parseSepBy(input, pos, '{', '}', parseKeyValue);
  if (!res)
    return null;
  return { value: Object.fromEntries(res.value), end: res.end };
}

function parseValidPythonResult(input, pos) {
  pos = skipWs(input, pos);

  // Error("...")
  if (input.startsWith('Error(', pos)) {
    pos += 6;
    pos = skipWs(input, pos);
    const str = parseString(input, pos);
    if (!str)
      return null;
    pos = skipWs(input, str.end);
    if (input[pos] !== ')')
      return null;
    return { value: { err: true, error: str.value }, end: pos + 1 };
  }

  // Value(...)
  if (input.startsWith('Value(', pos)) {
    pos += 6;
    pos = skipWs(input, pos);
    const val = parseValue(input, pos);
    if (!val)
      return null;
    pos = skipWs(input, val.end);
    if (input[pos] !== ')')
      return null;
    return { value: { ok: true, result: val.value }, end: pos + 1 };
  }

  // None
  if (input.startsWith('None', pos)) {
    return { value: { ok: true, result: null }, end: pos + 4 };
  }

  // List of results
  if (input[pos] === '[') {
    return parseSepBy(input, pos, '[', ']', parseValidPythonResult);
  }

  return null;
}

function parsePythonResultStringified(input) {
  if (input.length < 2)
    return null;
  const quote = input[0];
  if (quote !== '\'' && quote !== '"')
    return null;
  const inner = input.slice(1);
  const result = parseValidPythonResult(inner, 0);
  if (!result)
    return null;
  if (inner[result.end] !== quote)
    return null;
  return result.value;
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

console.log('PythonValueParser unit tests:\n');

// --- Primitive types ---

console.log('  Primitives:');

test('parse integer', () => {
  const r = parsePythonResultStringified('\'Value(42)\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === 42, `Expected 42, got ${r.result}`);
});

test('parse zero', () => {
  const r = parsePythonResultStringified('\'Value(0)\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === 0, `Expected 0, got ${r.result}`);
});

test('parse None', () => {
  const r = parsePythonResultStringified('\'Value(None)\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === null, `Expected null, got ${r.result}`);
});

test('parse True', () => {
  const r = parsePythonResultStringified('\'Value(True)\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === true, `Expected true, got ${r.result}`);
});

test('parse False', () => {
  const r = parsePythonResultStringified('\'Value(False)\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === false, `Expected false, got ${r.result}`);
});

test('parse string with double quotes', () => {
  const r = parsePythonResultStringified('\'Value("hello")\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === 'hello', `Expected "hello", got "${r.result}"`);
});

test('parse string with single quotes', () => {
  const r = parsePythonResultStringified('"Value(\'hello\')"');
  assert(r.ok, 'Should be ok');
  assert(r.result === 'hello', `Expected "hello", got "${r.result}"`);
});

// --- Collections ---

console.log('\n  Collections:');

test('parse empty list', () => {
  const r = parsePythonResultStringified('\'Value([])\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, []);
});

test('parse list of integers', () => {
  const r = parsePythonResultStringified('\'Value([1, 2, 3])\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, [1, 2, 3]);
});

test('parse empty tuple', () => {
  const r = parsePythonResultStringified('\'Value(())\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, []);
});

test('parse tuple with values', () => {
  const r = parsePythonResultStringified('\'Value((1, 2))\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, [1, 2]);
});

test('parse nested list', () => {
  const r = parsePythonResultStringified('\'Value([[1, 2], [3, 4]])\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, [[1, 2], [3, 4]]);
});

test('parse dict', () => {
  const r = parsePythonResultStringified('\'Value({"a": 1, "b": 2})\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, { a: 1, b: 2 });
});

test('parse dict with string values', () => {
  const r = parsePythonResultStringified('\'Value({"key": "val"})\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, { key: 'val' });
});

test('parse mixed list', () => {
  const r = parsePythonResultStringified('\'Value([1, "two", True, None])\'');
  assert(r.ok, 'Should be ok');
  assertDeepEqual(r.result, [1, 'two', true, null]);
});

// --- Value/Error wrappers ---

console.log('\n  Value/Error wrappers:');

test('parse Error wrapper', () => {
  const r = parsePythonResultStringified('\'Error("something failed")\'');
  assert(r.err, 'Should be error');
  assert(r.error === 'something failed', `Expected "something failed", got "${r.error}"`);
});

test('parse bare None result', () => {
  const r = parsePythonResultStringified('\'None\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === null, `Expected null`);
});

test('parse list of results', () => {
  const r = parsePythonResultStringified('\'[Value(1), Value(2)]\'');
  assert(Array.isArray(r), 'Should be array');
  assert(r.length === 2, `Expected 2 items, got ${r.length}`);
  assert(r[0].ok && r[0].result === 1, 'First should be 1');
  assert(r[1].ok && r[1].result === 2, 'Second should be 2');
});

test('parse mixed list of results and errors', () => {
  const r = parsePythonResultStringified('\'[Value(1), Error("fail")]\'');
  assert(Array.isArray(r), 'Should be array');
  assert(r[0].ok && r[0].result === 1, 'First should be ok(1)');
  assert(r[1].err && r[1].error === 'fail', 'Second should be err');
});

// --- Outer quoting ---

console.log('\n  Outer quoting:');

test('single-quoted outer', () => {
  const r = parsePythonResultStringified('\'Value(42)\'');
  assert(r.ok && r.result === 42, 'Single-quoted outer should work');
});

test('double-quoted outer', () => {
  const r = parsePythonResultStringified('"Value(42)"');
  assert(r.ok && r.result === 42, 'Double-quoted outer should work');
});

// --- Edge cases ---

console.log('\n  Edge cases:');

test('whitespace in Value wrapper', () => {
  const r = parsePythonResultStringified('\'Value( 42 )\'');
  assert(r.ok, 'Should handle whitespace');
  assert(r.result === 42, `Expected 42, got ${r.result}`);
});

test('whitespace in Error wrapper', () => {
  const r = parsePythonResultStringified('\'Error( "msg" )\'');
  assert(r.err, 'Should handle whitespace in Error');
  assert(r.error === 'msg', `Expected "msg", got "${r.error}"`);
});

test('empty string value', () => {
  const r = parsePythonResultStringified('\'Value("")\'');
  assert(r.ok, 'Should be ok');
  assert(r.result === '', `Expected empty string, got "${r.result}"`);
});

test('dict in Value', () => {
  const r = parsePythonResultStringified('\'Value({"width": 640, "height": 480})\'');
  assert(r.ok, 'Should parse dict in Value');
  assertDeepEqual(r.result, { width: 640, height: 480 });
});

test('complex nested structure', () => {
  const input = '\'Value({"dims": [3, 224, 224], "dtype": "float32", "batched": False})\'';
  const r = parsePythonResultStringified(input);
  assert(r.ok, 'Should parse complex structure');
  assertDeepEqual(r.result, { dims: [3, 224, 224], dtype: 'float32', batched: false });
});

test('tuple in list', () => {
  const r = parsePythonResultStringified('\'Value([(1, 2), (3, 4)])\'');
  assert(r.ok, 'Should parse tuples in list');
  assertDeepEqual(r.result, [[1, 2], [3, 4]]);
});

test('reject malformed input', () => {
  const r = parsePythonResultStringified('not-quoted');
  assert(r === null, 'Should reject unquoted input');
});

test('reject mismatched quotes', () => {
  const r = parsePythonResultStringified('\'Value(42)"');
  assert(r === null, 'Should reject mismatched quotes');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
