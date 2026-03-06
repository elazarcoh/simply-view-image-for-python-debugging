/* eslint-disable no-console, node/prefer-global/process */
/**
 * Unit tests for PythonValueParser — escaped quote handling (R6).
 *
 * Bug: The String parser uses `takeWhile(c => c !== quote)` which stops at
 * the first quote character, even if it's escaped with a backslash.
 * Python's sanitize() strips quotes instead of escaping them (data loss).
 *
 * Fix:
 * 1. Python sanitize(): escape " and \ instead of stripping
 * 2. parsePythonResult(): strip repr quoting before parsing
 * 3. String parser: handle \" and \\ escape sequences
 *
 * Run: node tests/unit/ts/test_parser_escape.js
 */

const path = require('node:path');

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

const P = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'parsimmon'));

// --- stripReprQuoting: removes Python repr outer wrapping ---

function stripReprQuoting(s) {
  if (s.length < 2)
    return s;
  const quote = s[0];
  if ((quote !== '\'' && quote !== '"') || s[s.length - 1] !== quote) {
    return s;
  }
  const inner = s.slice(1, -1);
  let result = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const next = inner[i + 1];
      if (next === '\\') {
        result += '\\';
        i++;
      }
      else if (next === quote) {
        result += quote;
        i++;
      }
      else if (next === 'n') {
        result += '\n';
        i++;
      }
      else if (next === 't') {
        result += '\t';
        i++;
      }
      else if (next === 'r') {
        result += '\r';
        i++;
      }
      else {
        result += inner[i];
      }
    }
    else {
      result += inner[i];
    }
  }
  return result;
}

// --- Fixed parser with escape-aware String rule ---

function buildFixedParser() {
  function ListOf(parser) {
    return parser
      .sepBy(P.string(',').trim(P.optWhitespace))
      .wrap(P.string('['), P.string(']'));
  }

  return P.createLanguage({
    Quote: () => P.oneOf('\'"'),
    Tuple: r =>
      r.PythonValue.sepBy(P.string(',').trim(P.optWhitespace)).wrap(
        P.string('('),
        P.string(')'),
      ),
    List: r => ListOf(r.PythonValue),
    String: r =>
      r.Quote.chain((quote) => {
        const escapedQuote = P.string(`\\${quote}`).map(() => quote);
        const escapedBackslash = P.string('\\\\').map(() => '\\');
        const regular = P.test(c => c !== quote && c !== '\\');
        return P.alt(escapedQuote, escapedBackslash, regular)
          .many()
          .map(chars => chars.join(''))
          .skip(P.string(quote));
      }),
    None: () => P.string('None').result(null),
    Boolean: () =>
      P.alt(P.string('True').result(true), P.string('False').result(false)),
    Integer: () => P.regexp(/\d+/).map(s => Number.parseInt(s, 10)),
    KeyValue: r =>
      P.seqObj(
        ['key', r.String],
        P.string(':').trim(P.optWhitespace),
        ['value', r.PythonValue],
      ),
    Dict: r =>
      r.KeyValue.sepBy(P.string(',').trim(P.optWhitespace))
        .wrap(
          P.string('{').trim(P.optWhitespace),
          P.string('}').trim(P.optWhitespace),
        )
        .map(
          keyValues =>
            Object.fromEntries(keyValues.map(kv => [kv.key, kv.value])),
        ),
    PythonValue: r =>
      P.alt(r.Tuple, r.String, r.Dict, r.List, r.None, r.Boolean, r.Integer),
    Error: r =>
      P.seqObj(
        P.string('Error'),
        P.string('(').trim(P.optWhitespace),
        ['error', r.String],
        P.string(')').trim(P.optWhitespace),
      ),
    Value: r =>
      P.seqObj(
        P.string('Value'),
        P.string('(').trim(P.optWhitespace),
        ['result', r.PythonValue],
        P.string(')').trim(P.optWhitespace),
      ),
    ValidPythonResult: r =>
      P.alt(
        r.Error.map(({ error }) => ({ ok: false, error })),
        r.Value.map(({ result }) => ({ ok: true, value: result })),
        r.None.map(() => ({ ok: true, value: null })),
        ListOf(r.ValidPythonResult),
      ),
  });
}

// --- Full parsePythonResult (fixed) ---

function parsePythonResult(value) {
  const parser = buildFixedParser();
  const stripped = stripReprQuoting(value);
  const res = parser.ValidPythonResult.parse(stripped);
  if (res.status) {
    return { ok: true, value: res.value };
  }
  return { ok: false, error: res.expected[0] };
}

// ========== TESTS ==========

console.log('PythonValueParser escaped quote tests:\n');

const parser = buildFixedParser();

// --- stripReprQuoting tests ---

test('stripReprQuoting: simple single-quoted', () => {
  const res = stripReprQuoting('\'hello\'');
  assert(res === 'hello', `Expected "hello", got "${res}"`);
});

test('stripReprQuoting: simple double-quoted', () => {
  const res = stripReprQuoting('"hello"');
  assert(res === 'hello', `Expected "hello", got "${res}"`);
});

test('stripReprQuoting: escaped quote inside', () => {
  const res = stripReprQuoting('\'it\\\'s nice\'');
  assert(res === 'it\'s nice', `Expected "it's nice", got "${res}"`);
});

test('stripReprQuoting: escaped backslash', () => {
  const res = stripReprQuoting('\'path\\\\to\'');
  assert(res === 'path\\to', `Expected "path\\to", got "${res}"`);
});

test('stripReprQuoting: not quoted', () => {
  const res = stripReprQuoting('hello');
  assert(res === 'hello', `Expected "hello", got "${res}"`);
});

// --- String parser: basic ---

test('parse simple double-quoted string', () => {
  const res = parser.String.parse('"hello"');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === 'hello', `Expected "hello", got "${res.value}"`);
});

test('parse simple single-quoted string', () => {
  const res = parser.String.parse('\'world\'');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === 'world', `Expected "world", got "${res.value}"`);
});

test('parse empty string', () => {
  const res = parser.String.parse('""');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === '', `Expected empty, got "${res.value}"`);
});

// --- String parser: escape handling ---

test('parse string with escaped double quote', () => {
  const res = parser.String.parse('"hello\\"world"');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === 'hello"world', `Expected 'hello"world', got "${res.value}"`);
});

test('parse string with escaped single quote', () => {
  const res = parser.String.parse('\'it\\\'s\'');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === 'it\'s', `Expected "it's", got "${res.value}"`);
});

test('parse string with escaped backslash', () => {
  const res = parser.String.parse('"path\\\\to\\\\file"');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === 'path\\to\\file', `Expected "path\\to\\file", got "${res.value}"`);
});

test('parse string with escaped backslash before close', () => {
  const res = parser.String.parse('"ends\\\\"');
  assert(res.status, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value === 'ends\\', `Expected "ends\\", got "${res.value}"`);
});

// --- Full parsePythonResult with repr wrapping ---

test('parsePythonResult: simple Value', () => {
  // Python repr: 'Value("hello")'
  const res = parsePythonResult('\'Value("hello")\'');
  assert(res.ok, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value.ok === true, 'Expected Ok result');
  assert(res.value.value === 'hello', `Expected "hello", got "${res.value.value}"`);
});

test('parsePythonResult: Value with integer', () => {
  const res = parsePythonResult('\'Value(42)\'');
  assert(res.ok, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value.ok === true, 'Expected Ok');
  assert(res.value.value === 42, `Expected 42, got ${res.value.value}`);
});

test('parsePythonResult: Error message', () => {
  const res = parsePythonResult('\'Error("something broke")\'');
  assert(res.ok, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value.ok === false, 'Expected Err');
  assert(res.value.error === 'something broke', `Expected "something broke", got "${res.value.error}"`);
});

test('parsePythonResult: Value with escaped quote in string', () => {
  // Python sanitize escapes " as \":  Value("hello\"world")
  // Python repr wraps in ':  'Value("hello\\"world")'
  // In JS string literal:    'Value("hello\\\\"world")'
  const input = '\'Value("hello\\\\"world")\'';
  const res = parsePythonResult(input);
  assert(res.ok, `Parse failed for input: ${JSON.stringify(res)}`);
  assert(res.value.ok === true, 'Expected Ok');
  assert(res.value.value === 'hello"world', `Expected 'hello"world', got "${res.value.value}"`);
});

test('parsePythonResult: list result', () => {
  const res = parsePythonResult('\'[Value(1), Value(2)]\'');
  assert(res.ok, `Parse failed: ${JSON.stringify(res)}`);
  assert(Array.isArray(res.value), 'Expected array');
  assert(res.value.length === 2, `Expected 2 elements, got ${res.value.length}`);
});

test('parsePythonResult: None', () => {
  const res = parsePythonResult('\'None\'');
  assert(res.ok, `Parse failed: ${JSON.stringify(res)}`);
  assert(res.value.ok === true, 'Expected Ok');
  assert(res.value.value === null, `Expected null, got ${res.value.value}`);
});

// --- Existing types still work ---

test('parse integer', () => {
  const res = parser.Integer.parse('42');
  assert(res.status && res.value === 42, 'Expected 42');
});

test('parse boolean', () => {
  const res = parser.Boolean.parse('True');
  assert(res.status && res.value === true, 'Expected true');
});

test('parse tuple', () => {
  const res = parser.Tuple.parse('(1, "two", 3)');
  assert(res.status, 'Parse failed');
  assert(res.value.length === 3 && res.value[1] === 'two', 'Unexpected tuple');
});

test('parse dict', () => {
  const res = parser.Dict.parse('{"key": 42}');
  assert(res.status, 'Parse failed');
  assert(res.value.key === 42, 'Expected key=42');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
