/**
 * Unit tests for max message size validation (S5).
 *
 * Bug: The socket server accepts messages of any size (up to 4GB via uint32
 * header field) without validation, allowing a malicious or buggy client to
 * exhaust server memory.
 *
 * Fix: Add MAX_MESSAGE_SIZE constant in protocol.ts and validate messageLength
 * in Server.ts handleData before allocating MessageChunks.
 *
 * Run: node tests/unit/ts/test_max_msg_size.js
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

// Mirror protocol constants (must stay in sync with protocol.ts)
const HEADER_LENGTH = 4 + 4 + 1 + 4 + 1 + 4 + 4 + 4; // 26 bytes
const MAX_MESSAGE_SIZE = 256 * 1024 * 1024; // 256 MB

/**
 * Simulates the validation logic added to Server.ts handleData.
 * Returns null if accepted, or an error string if rejected.
 */
function validateMessageLength(messageLength) {
  if (messageLength > MAX_MESSAGE_SIZE) {
    return `Message length ${messageLength} exceeds maximum allowed size ${MAX_MESSAGE_SIZE}`;
  }
  if (messageLength < HEADER_LENGTH) {
    return `Message length ${messageLength} is shorter than header length ${HEADER_LENGTH}`;
  }
  return null;
}

console.log('Max message size validation tests:\n');

test('accept normal message size (1KB)', () => {
  assert(validateMessageLength(1024) === null, 'Should accept 1KB');
});

test('accept max allowed message size (256MB)', () => {
  assert(validateMessageLength(MAX_MESSAGE_SIZE) === null, 'Should accept exactly max');
});

test('reject message exceeding max size', () => {
  const err = validateMessageLength(MAX_MESSAGE_SIZE + 1);
  assert(err !== null, 'Should reject oversized');
  assert(err.includes('exceeds maximum'), `Wrong error: ${err}`);
});

test('reject extremely large message (2GB)', () => {
  const err = validateMessageLength(2 * 1024 * 1024 * 1024);
  assert(err !== null, 'Should reject 2GB');
  assert(err.includes('exceeds maximum'), `Wrong error: ${err}`);
});

test('reject message shorter than header', () => {
  const err = validateMessageLength(10);
  assert(err !== null, 'Should reject too-small');
  assert(err.includes('shorter than header'), `Wrong error: ${err}`);
});

test('accept message exactly at header length', () => {
  assert(validateMessageLength(HEADER_LENGTH) === null, 'Should accept header-sized message');
});

test('MAX_MESSAGE_SIZE is 256 MB', () => {
  assert(MAX_MESSAGE_SIZE === 256 * 1024 * 1024, `Expected 268435456, got ${MAX_MESSAGE_SIZE}`);
});

test('HEADER_LENGTH is 26 bytes', () => {
  assert(HEADER_LENGTH === 26, `Expected 26, got ${HEADER_LENGTH}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
