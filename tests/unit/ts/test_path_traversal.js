/**
 * Unit tests for SavePathHelper.savePathFor() — path traversal prevention (S7).
 *
 * Bug: Variable names from DAP (evaluateName) can contain path separators
 * like "../" which path.join resolves, allowing writes outside saveDir.
 *
 * Run: node tests/unit/ts/test_path_traversal.js
 */

const path = require('node:path');

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
}
function assert(cond, msg) {
  if (!cond)
    throw new Error(msg);
}

// Minimal reproduction of the bug
function savePathForBuggy(saveDir, variable) {
  return path.join(saveDir, `${variable}`).replace(/\\/g, '/');
}

// Fixed version — sanitizes variable names
function sanitizeForFilename(name) {
  return name.replace(/[^\w\-.]/g, '_');
}

function savePathForFixed(saveDir, variable) {
  const sanitized = sanitizeForFilename(variable);
  return path.join(saveDir, sanitized).replace(/\\/g, '/');
}

console.log('SavePathHelper.savePathFor path traversal tests:\n');

test('Bug: ../../ escapes save directory', () => {
  const saveDir = '/tmp/svifpd/images/session1';
  const result = savePathForBuggy(saveDir, '../../etc/passwd');
  // path.join resolves .. and escapes the directory
  assert(!result.startsWith(saveDir), `Expected path to escape saveDir, got: ${result}`);
  assert(result === '/tmp/svifpd/etc/passwd' || result.includes('/etc/passwd'), `Expected traversal, got: ${result}`);
});

test('Fix: ../../ sanitized to safe filename', () => {
  const saveDir = '/tmp/svifpd/images/session1';
  const result = savePathForFixed(saveDir, '../../etc/passwd');
  assert(result.startsWith(`${saveDir}/`), `Expected path inside saveDir, got: ${result}`);
  // Slashes removed, so ".." can't be a path segment — stays inside saveDir
});

test('Fix: normal variable name preserved', () => {
  const saveDir = '/tmp/svifpd/images/session1';
  const result = savePathForFixed(saveDir, 'my_var_123');
  assert(result === `${saveDir}/my_var_123`, `Expected exact name, got: ${result}`);
});

test('Fix: evaluateName with brackets sanitized', () => {
  const saveDir = '/tmp/svifpd/images/session1';
  const result = savePathForFixed(saveDir, 'data[\'../../key\']');
  assert(result.startsWith(`${saveDir}/`), `Expected path inside saveDir, got: ${result}`);
});

test('Fix: expression with slashes sanitized', () => {
  const saveDir = '/tmp/svifpd/images/session1';
  const result = savePathForFixed(saveDir, 'obj.attr/../../etc');
  assert(result.startsWith(`${saveDir}/`), `Expected path inside saveDir, got: ${result}`);
});

test('Fix: empty string handled', () => {
  const saveDir = '/tmp/svifpd/images/session1';
  const result = savePathForFixed(saveDir, '');
  assert(result.startsWith(saveDir), `Expected path inside saveDir, got: ${result}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
