/* eslint-disable no-console, node/prefer-global/process */
/**
 * Smoke test to verify the TS unit test runner infrastructure works.
 *
 * Run: node tests/unit/ts/test_smoke.js
 */

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

console.log('Smoke tests:\n');

test('basic assertion works', () => {
  assert(1 + 1 === 2, 'math is broken');
});

test('string operations work', () => {
  assert('hello'.includes('ell'), 'string.includes failed');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
