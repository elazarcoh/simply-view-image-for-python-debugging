/**
 * Unit tests for MessageChunks reassembly logic (T2).
 *
 * Tests the chunked message reassembly used by the socket server:
 * - Single chunk messages
 * - Multi-chunk assembly in order and out of order
 * - Consistency validation (mismatched counts, lengths, etc.)
 * - Duplicate chunk handling
 * - isComplete() and fullMessage() behavior
 *
 * Run: node tests/unit/ts/test_chunks.js
 */

const { Buffer } = require('node:buffer');

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

function assertThrows(fn, expectedMsg) {
  let threw = false;
  try {
    fn();
  }
  catch (e) {
    threw = true;
    if (expectedMsg && !e.message.includes(expectedMsg)) {
      throw new Error(`Expected error containing "${expectedMsg}", got: "${e.message}"`);
    }
  }
  assert(threw, `Expected function to throw${expectedMsg ? ` with "${expectedMsg}"` : ''}`);
}

// -------------------------------------------------------------------
// Minimal reimplementation of MessageChunks for testing
// Mirrors src/python-communication/socket-based/MessageChunks.ts
// -------------------------------------------------------------------

class MessageChunks {
  constructor(expectedMessageLength, expectedChunkCount) {
    this.expectedMessageLength = expectedMessageLength;
    this.expectedChunkCount = expectedChunkCount;
    this.messageChunks = Array.from({ length: expectedChunkCount }).fill(null);
    this.messageHeaders = Array.from({ length: expectedChunkCount }).fill(null);
    this.messageLength = 0;
  }

  addChunk(header, chunk) {
    const { chunkNumber, chunkCount, chunkLength, messageLength: totalLength } = header;
    if (chunkCount !== this.expectedChunkCount) {
      throw new Error(
        `(reqId ${header.requestId}) Expected chunk count ${this.expectedChunkCount} but got ${chunkCount}`,
      );
    }
    if (totalLength !== this.expectedMessageLength) {
      throw new Error(
        `(reqId ${header.requestId}) Expected message length ${this.expectedMessageLength} but got ${totalLength}`,
      );
    }
    if (chunkNumber >= this.expectedChunkCount) {
      throw new Error(
        `(reqId ${header.requestId}) Chunk number ${chunkNumber} is out of bounds (chunk count is ${chunkCount})`,
      );
    }
    if (chunkLength !== chunk.length) {
      throw new Error(
        `(reqId ${header.requestId}) Chunk length ${chunkLength} does not match chunk length ${chunk.length}`,
      );
    }
    const currentHeader = this.messageHeaders[chunkNumber];
    if (currentHeader !== null) {
      if (
        currentHeader.messageID !== header.messageID
        || currentHeader.chunkCount !== header.chunkCount
        || currentHeader.chunkLength !== header.chunkLength
        || currentHeader.messageLength !== header.messageLength
        || currentHeader.requestId !== header.requestId
        || currentHeader.sender !== header.sender
        || currentHeader.messageType !== header.messageType
      ) {
        throw new Error(
          `(reqId ${header.requestId}) Chunk number ${chunkNumber} already exists.`,
        );
      }
      else {
        return; // duplicate, ignore
      }
    }
    const currentChunk = this.messageChunks[chunkNumber];
    if (currentChunk !== null) {
      if (!currentChunk.equals(chunk)) {
        throw new Error(
          `(reqId ${header.requestId}) Chunk number ${chunkNumber} already exists with different data.`,
        );
      }
      else {
        return; // duplicate, ignore
      }
    }

    this.messageChunks[chunkNumber] = chunk;
    this.messageHeaders[chunkNumber] = header;
    this.messageLength += chunkLength;
  }

  isComplete() {
    return (
      this.messageLength === this.expectedMessageLength
      && this.messageChunks.every(chunk => chunk !== null)
    );
  }

  fullMessage() {
    if (!this.isComplete()) {
      throw new Error('Message is not complete');
    }
    return Buffer.concat(this.messageChunks);
  }
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function makeHeader(overrides = {}) {
  return {
    messageLength: 10,
    messageID: 1,
    sender: 0x02,
    requestId: 100,
    messageType: 0x01,
    chunkCount: 1,
    chunkNumber: 0,
    chunkLength: 10,
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

console.log('MessageChunks unit tests:\n');

// --- Single chunk ---

console.log('  Single chunk:');

test('single chunk completes message', () => {
  const data = Buffer.from('0123456789');
  const mc = new MessageChunks(10, 1);
  const header = makeHeader({ messageLength: 10, chunkCount: 1, chunkNumber: 0, chunkLength: 10 });
  mc.addChunk(header, data);
  assert(mc.isComplete(), 'Should be complete');
  assert(mc.fullMessage().equals(data), 'Full message should match');
});

test('not complete before adding chunk', () => {
  const mc = new MessageChunks(10, 1);
  assert(!mc.isComplete(), 'Should not be complete');
});

test('fullMessage throws when not complete', () => {
  const mc = new MessageChunks(10, 1);
  assertThrows(() => mc.fullMessage(), 'Message is not complete');
});

// --- Multi chunk ---

console.log('\n  Multi chunk:');

test('two chunks in order', () => {
  const chunk0 = Buffer.from('hello');
  const chunk1 = Buffer.from('world');
  const mc = new MessageChunks(10, 2);

  mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 2, chunkNumber: 0, chunkLength: 5 }), chunk0);
  assert(!mc.isComplete(), 'Not complete after first chunk');

  mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 2, chunkNumber: 1, chunkLength: 5 }), chunk1);
  assert(mc.isComplete(), 'Complete after second chunk');
  assert(mc.fullMessage().equals(Buffer.from('helloworld')), 'Reassembled correctly');
});

test('two chunks out of order', () => {
  const chunk0 = Buffer.from('hello');
  const chunk1 = Buffer.from('world');
  const mc = new MessageChunks(10, 2);

  mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 2, chunkNumber: 1, chunkLength: 5 }), chunk1);
  assert(!mc.isComplete(), 'Not complete after second chunk only');

  mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 2, chunkNumber: 0, chunkLength: 5 }), chunk0);
  assert(mc.isComplete(), 'Complete after both chunks');
  assert(mc.fullMessage().equals(Buffer.from('helloworld')), 'Reassembled in correct order');
});

test('three chunks', () => {
  const mc = new MessageChunks(9, 3);
  mc.addChunk(makeHeader({ messageLength: 9, chunkCount: 3, chunkNumber: 0, chunkLength: 3 }), Buffer.from('abc'));
  mc.addChunk(makeHeader({ messageLength: 9, chunkCount: 3, chunkNumber: 2, chunkLength: 3 }), Buffer.from('ghi'));
  assert(!mc.isComplete(), 'Missing middle chunk');
  mc.addChunk(makeHeader({ messageLength: 9, chunkCount: 3, chunkNumber: 1, chunkLength: 3 }), Buffer.from('def'));
  assert(mc.isComplete(), 'All chunks received');
  assert(mc.fullMessage().equals(Buffer.from('abcdefghi')), 'Correct order');
});

// --- Validation ---

console.log('\n  Validation:');

test('reject mismatched chunk count', () => {
  const mc = new MessageChunks(10, 2);
  assertThrows(
    () => mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 3, chunkNumber: 0, chunkLength: 5 }), Buffer.from('hello')),
    'Expected chunk count 2 but got 3',
  );
});

test('reject mismatched message length', () => {
  const mc = new MessageChunks(10, 1);
  assertThrows(
    () => mc.addChunk(makeHeader({ messageLength: 20, chunkCount: 1, chunkNumber: 0, chunkLength: 10 }), Buffer.alloc(10)),
    'Expected message length 10 but got 20',
  );
});

test('reject chunk number out of bounds', () => {
  const mc = new MessageChunks(10, 2);
  assertThrows(
    () => mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 2, chunkNumber: 5, chunkLength: 5 }), Buffer.alloc(5)),
    'out of bounds',
  );
});

test('reject chunk length mismatch', () => {
  const mc = new MessageChunks(10, 1);
  assertThrows(
    () => mc.addChunk(makeHeader({ messageLength: 10, chunkCount: 1, chunkNumber: 0, chunkLength: 5 }), Buffer.alloc(10)),
    'does not match',
  );
});

// --- Duplicate handling ---

console.log('\n  Duplicate handling:');

test('identical duplicate chunk is silently ignored', () => {
  const data = Buffer.from('hello');
  const mc = new MessageChunks(5, 1);
  const header = makeHeader({ messageLength: 5, chunkCount: 1, chunkNumber: 0, chunkLength: 5 });
  mc.addChunk(header, data);
  // Same header and data — should not throw
  mc.addChunk(header, data);
  assert(mc.isComplete(), 'Should still be complete');
  assert(mc.fullMessage().equals(data), 'Data should be unchanged');
});

test('duplicate chunk number with different header throws', () => {
  const mc = new MessageChunks(5, 1);
  const header1 = makeHeader({ messageLength: 5, chunkCount: 1, chunkNumber: 0, chunkLength: 5, messageID: 1 });
  const header2 = makeHeader({ messageLength: 5, chunkCount: 1, chunkNumber: 0, chunkLength: 5, messageID: 2 });
  mc.addChunk(header1, Buffer.from('hello'));
  assertThrows(
    () => mc.addChunk(header2, Buffer.from('hello')),
    'already exists',
  );
});

// --- Edge cases ---

console.log('\n  Edge cases:');

test('zero-length message with zero chunks', () => {
  const mc = new MessageChunks(0, 0);
  assert(mc.isComplete(), 'Zero-chunk message is immediately complete');
  assert(mc.fullMessage().length === 0, 'Full message is empty');
});

test('large chunk count pre-allocates arrays', () => {
  const mc = new MessageChunks(100, 100);
  assert(!mc.isComplete(), 'Not complete with no chunks added');
  // Verify internal array was created with correct size
  // (This tests that the constructor doesn't crash with large counts)
});

test('binary data preserved through reassembly', () => {
  const chunk0 = Buffer.from([0x00, 0xFF, 0x80, 0x01]);
  const chunk1 = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
  const mc = new MessageChunks(8, 2);
  mc.addChunk(makeHeader({ messageLength: 8, chunkCount: 2, chunkNumber: 0, chunkLength: 4 }), chunk0);
  mc.addChunk(makeHeader({ messageLength: 8, chunkCount: 2, chunkNumber: 1, chunkLength: 4 }), chunk1);
  const result = mc.fullMessage();
  assert(result.equals(Buffer.from([0x00, 0xFF, 0x80, 0x01, 0xDE, 0xAD, 0xBE, 0xEF])), 'Binary data preserved');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
