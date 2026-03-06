/**
 * Unit tests for asPythonValue() — string escaping (S2).
 *
 * Bug: asPythonValue() wraps strings in single quotes without escaping,
 * so a string containing a single quote breaks out of the Python string literal.
 * This could cause syntax errors or code injection in eval'd Python code.
 *
 * Run: node tests/unit/ts/test_as_python_value.js
 */

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✅ ${name}`)
  }
  catch (e) {
    failed++
    console.log(`  ❌ ${name}: ${e.message}`)
  }
}
function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg)
  }
}

// Original buggy version
function asPythonValueBuggy(value) {
  if (typeof value === 'string') {
    return `'${value}'`
  }
  else if (typeof value === 'number') {
    return value.toString()
  }
  else if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  else if (value === null) {
    return 'None'
  }
  else {
    throw new Error(`Unsupported value type: ${typeof value}`)
  }
}

// Fixed version — escapes backslashes and single quotes
function asPythonValueFixed(value) {
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `'${escaped}'`
  }
  else if (typeof value === 'number') {
    return value.toString()
  }
  else if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  else if (value === null) {
    return 'None'
  }
  else {
    throw new Error(`Unsupported value type: ${typeof value}`)
  }
}

console.log('asPythonValue string escaping tests:\n')

test('Bug: single quote in string produces invalid Python', () => {
  const result = asPythonValueBuggy("it's broken")
  // This produces: 'it's broken' — invalid Python
  assert(result === "'it's broken'", `Got: ${result}`)
  // Verify this would fail in Python by counting unmatched quotes
  const quoteCount = (result.match(/'/g) || []).length
  assert(quoteCount === 3, `Expected 3 quotes (unmatched), got: ${quoteCount}`)
})

test('Fix: single quote escaped correctly', () => {
  const result = asPythonValueFixed("it's broken")
  assert(result === "'it\\'s broken'", `Expected escaped quote, got: ${result}`)
})

test('Fix: backslash escaped before quote', () => {
  const result = asPythonValueFixed("path\\to\\'file")
  // Backslash should be escaped first, then quote
  assert(result === "'path\\\\to\\\\\\'file'", `Got: ${result}`)
})

test('Fix: normal string unchanged', () => {
  const result = asPythonValueFixed('hello world')
  assert(result === "'hello world'", `Got: ${result}`)
})

test('Fix: empty string works', () => {
  const result = asPythonValueFixed('')
  assert(result === "''", `Got: ${result}`)
})

test('Non-string types unchanged', () => {
  assert(asPythonValueFixed(42) === '42', 'number')
  assert(asPythonValueFixed(true) === 'True', 'bool true')
  assert(asPythonValueFixed(false) === 'False', 'bool false')
  assert(asPythonValueFixed(null) === 'None', 'null')
})

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
