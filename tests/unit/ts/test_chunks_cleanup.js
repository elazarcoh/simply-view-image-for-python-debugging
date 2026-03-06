/**
 * Unit tests for SocketServer chunksByMessageId cleanup (R3).
 *
 * Bug: After a chunked message is fully reassembled and handled,
 * the entry in chunksByMessageId is never deleted, causing unbounded
 * memory growth over long debug sessions.
 *
 * Run: node tests/unit/ts/test_chunks_cleanup.js
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

// Minimal MessageChunks reproduction
class MessageChunks {
  constructor(messageLength, chunkCount) {
    this._messageLength = messageLength
    this._chunkCount = chunkCount
    this._chunks = []
  }

  addChunk(header, content) {
    this._chunks.push({ header, content })
  }

  isComplete() {
    return this._chunks.length === this._chunkCount
  }

  fullMessage() {
    return Buffer.concat(this._chunks.map(c => c.content))
  }
}

function setDefault(map, key, ctor) {
  if (!map.has(key)) {
    map.set(key, ctor())
  }
  return map.get(key)
}

// Simulate the buggy handleData logic
function processMessageBuggy(chunksByMessageId, header, content, onComplete) {
  const chunks = setDefault(
    chunksByMessageId,
    header.messageID,
    () => new MessageChunks(header.messageLength, header.chunkCount),
  )
  chunks.addChunk(header, content)
  if (chunks.isComplete()) {
    onComplete(header, chunks.fullMessage())
    // BUG: no cleanup — entry stays in map
  }
}

// Fixed version
function processMessageFixed(chunksByMessageId, header, content, onComplete) {
  const chunks = setDefault(
    chunksByMessageId,
    header.messageID,
    () => new MessageChunks(header.messageLength, header.chunkCount),
  )
  chunks.addChunk(header, content)
  if (chunks.isComplete()) {
    onComplete(header, chunks.fullMessage())
    chunksByMessageId.delete(header.messageID) // FIX: clean up
  }
}

console.log('SocketServer chunksByMessageId cleanup tests:\n')

test('Bug: completed messages stay in map', () => {
  const map = new Map()
  const header = { messageID: 1, messageLength: 5, chunkCount: 1, chunkIndex: 0, requestId: 1 }
  processMessageBuggy(map, header, Buffer.from('hello'), () => {})
  assert(map.size === 1, `Expected map to retain entry (bug), size=${map.size}`)
})

test('Bug: 100 messages = 100 orphaned entries', () => {
  const map = new Map()
  for (let i = 0; i < 100; i++) {
    const header = { messageID: i, messageLength: 3, chunkCount: 1, chunkIndex: 0, requestId: i }
    processMessageBuggy(map, header, Buffer.from('abc'), () => {})
  }
  assert(map.size === 100, `Expected 100 orphaned entries, got ${map.size}`)
})

test('Fix: completed messages cleaned up', () => {
  const map = new Map()
  const header = { messageID: 1, messageLength: 5, chunkCount: 1, chunkIndex: 0, requestId: 1 }
  processMessageFixed(map, header, Buffer.from('hello'), () => {})
  assert(map.size === 0, `Expected map to be empty after completion, size=${map.size}`)
})

test('Fix: multi-chunk message cleaned after last chunk', () => {
  const map = new Map()
  const makeHeader = (idx) => ({
    messageID: 1, messageLength: 10, chunkCount: 3, chunkIndex: idx, requestId: 1,
  })
  processMessageFixed(map, makeHeader(0), Buffer.from('aaa'), () => {})
  assert(map.size === 1, 'Should retain incomplete message')
  processMessageFixed(map, makeHeader(1), Buffer.from('bbb'), () => {})
  assert(map.size === 1, 'Still incomplete')
  let completed = false
  processMessageFixed(map, makeHeader(2), Buffer.from('cccc'), () => { completed = true })
  assert(completed, 'Callback should fire')
  assert(map.size === 0, `Should be cleaned up, size=${map.size}`)
})

test('Fix: 100 messages = 0 leftover entries', () => {
  const map = new Map()
  for (let i = 0; i < 100; i++) {
    const header = { messageID: i, messageLength: 3, chunkCount: 1, chunkIndex: 0, requestId: i }
    processMessageFixed(map, header, Buffer.from('abc'), () => {})
  }
  assert(map.size === 0, `Expected 0 entries, got ${map.size}`)
})

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
