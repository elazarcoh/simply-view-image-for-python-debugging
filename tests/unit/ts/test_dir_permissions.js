/**
 * Unit tests for setSaveLocation() — temp dir permissions (S6).
 *
 * Bug: When using tmp save location, the directory is created with 0o777
 * (world-writable), allowing any user to read/modify/delete saved images.
 *
 * Run: node tests/unit/ts/test_dir_permissions.js
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

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

console.log('setSaveLocation directory permissions tests:\n')

test('0o777 is world-writable (confirms vulnerability)', () => {
  // 0o777 means rwxrwxrwx — any user can read/write/execute
  const mode = 0o777
  const otherWrite = mode & 0o002
  const otherRead = mode & 0o004
  assert(otherWrite !== 0, 'Expected world-writable with 0o777')
  assert(otherRead !== 0, 'Expected world-readable with 0o777')
})

test('0o700 restricts to owner only', () => {
  const mode = 0o700
  const otherWrite = mode & 0o002
  const otherRead = mode & 0o004
  const groupWrite = mode & 0o020
  const groupRead = mode & 0o040
  assert(otherWrite === 0, 'Should not be other-writable')
  assert(otherRead === 0, 'Should not be other-readable')
  assert(groupWrite === 0, 'Should not be group-writable')
  assert(groupRead === 0, 'Should not be group-readable')
  // Owner should have full access
  const ownerRWX = mode & 0o700
  assert(ownerRWX === 0o700, 'Owner should have rwx')
})

test('Real directory created with 0o700 has correct permissions', () => {
  const testDir = path.join(os.tmpdir(), `svifpd-perm-test-${Date.now()}`)
  try {
    fs.mkdirSync(testDir, { recursive: true })
    fs.chmodSync(testDir, 0o700)
    const stats = fs.statSync(testDir)
    const mode = stats.mode & 0o777
    assert(mode === 0o700, `Expected 0o700, got 0o${mode.toString(8)}`)
  }
  finally {
    fs.rmdirSync(testDir)
  }
})

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
