/**
 * Unit tests for triple-quote injection guard in exec() (S1).
 *
 * Bug: Python code is embedded via exec('''...'''). If the embedded
 * content contains ''', it breaks out of the string literal.
 *
 * Run: node tests/unit/ts/test_triple_quote_guard.js
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

// Guard function that detects triple quotes in content
function assertNoTripleQuotes(content, context) {
  if (content.includes("'''")) {
    throw new Error(
      `Python code for ${context} contains triple single quotes (''') which would break exec() embedding. `
      + 'Use double quotes or escape sequences instead.',
    )
  }
}

console.log("exec() triple-quote injection guard tests:\n")

test('Guard catches triple quotes in content', () => {
  let threw = false
  try {
    assertNoTripleQuotes("x = '''hello'''", 'test-module')
  }
  catch (e) {
    threw = true
    assert(e.message.includes('triple single quotes'), `Wrong error: ${e.message}`)
  }
  assert(threw, 'Should have thrown')
})

test('Guard allows safe content', () => {
  assertNoTripleQuotes('x = "hello"', 'test-module')
  assertNoTripleQuotes("x = 'hello'", 'test-module')
  assertNoTripleQuotes('x = """hello"""', 'test-module')
})

test('Guard catches embedded triple quotes mid-string', () => {
  let threw = false
  try {
    assertNoTripleQuotes("before\n'''\nafter", 'test')
  }
  catch {
    threw = true
  }
  assert(threw, 'Should catch triple quotes anywhere')
})

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
