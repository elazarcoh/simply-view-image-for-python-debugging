/**
 * Unit tests for socket authentication via shared secret (S4).
 *
 * Bug: The socket server accepts connections from any process on localhost
 * without authentication. Any local process that discovers the port can
 * inject data.
 *
 * Fix: Server generates a random 32-byte secret. Python client sends the
 * secret as the first 32 bytes on each connection. Server validates before
 * processing any messages.
 *
 * Run: node tests/unit/ts/test_socket_auth.js
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

const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');

const AUTH_SECRET_LENGTH = 32;

/**
 * Simulates the auth validation logic that will be added to Server.ts.
 * Returns true if the provided token matches the expected secret.
 */
function validateAuth(receivedBytes, expectedSecret) {
  if (receivedBytes.length < AUTH_SECRET_LENGTH) {
    return { authenticated: false, rest: Buffer.alloc(0), reason: 'incomplete' };
  }
  const token = receivedBytes.subarray(0, AUTH_SECRET_LENGTH);
  const rest = receivedBytes.subarray(AUTH_SECRET_LENGTH);
  if (crypto.timingSafeEqual(token, expectedSecret)) {
    return { authenticated: true, rest };
  }
  return { authenticated: false, rest: Buffer.alloc(0), reason: 'mismatch' };
}

console.log('Socket authentication tests:\n');

test('generate secret is 32 bytes', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  assert(secret.length === AUTH_SECRET_LENGTH, `Expected ${AUTH_SECRET_LENGTH}, got ${secret.length}`);
});

test('secret as hex string is 64 chars', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const hex = secret.toString('hex');
  assert(hex.length === 64, `Expected 64, got ${hex.length}`);
});

test('hex roundtrip preserves secret', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const hex = secret.toString('hex');
  const recovered = Buffer.from(hex, 'hex');
  assert(secret.equals(recovered), 'Roundtrip failed');
});

test('valid auth succeeds', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const result = validateAuth(secret, secret);
  assert(result.authenticated === true, 'Should authenticate');
  assert(result.rest.length === 0, 'No remaining bytes');
});

test('valid auth with trailing data returns rest', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const payload = Buffer.from('hello world');
  const combined = Buffer.concat([secret, payload]);
  const result = validateAuth(combined, secret);
  assert(result.authenticated === true, 'Should authenticate');
  assert(result.rest.equals(payload), 'Should return remaining data');
});

test('wrong secret fails auth', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const wrong = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const result = validateAuth(wrong, secret);
  assert(result.authenticated === false, 'Should reject');
  assert(result.reason === 'mismatch', 'Reason should be mismatch');
});

test('partial secret returns incomplete', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const partial = secret.subarray(0, 16);
  const result = validateAuth(partial, secret);
  assert(result.authenticated === false, 'Should not authenticate with partial');
  assert(result.reason === 'incomplete', 'Reason should be incomplete');
});

test('empty buffer returns incomplete', () => {
  const secret = crypto.randomBytes(AUTH_SECRET_LENGTH);
  const result = validateAuth(Buffer.alloc(0), secret);
  assert(result.authenticated === false, 'Should not authenticate with empty');
  assert(result.reason === 'incomplete', 'Reason should be incomplete');
});

test('timing-safe comparison used (same length, different content)', () => {
  const secret = Buffer.alloc(AUTH_SECRET_LENGTH, 0xAA);
  const almost = Buffer.alloc(AUTH_SECRET_LENGTH, 0xAA);
  almost[AUTH_SECRET_LENGTH - 1] = 0xBB;
  const result = validateAuth(almost, secret);
  assert(result.authenticated === false, 'Should reject near-match');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
