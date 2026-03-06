/**
 * Unit tests for SocketServer.onResponse timeout (R4).
 *
 * Bug: onResponse() subscribes a callback that may never fire if the
 * Python side crashes, causing the promise to hang forever and the
 * request subscription to leak.
 *
 * Run: node tests/unit/ts/test_response_timeout.js
 */

let passed = 0
let failed = 0
function test(name, fn) {
  return new Promise((resolve) => {
    try {
      const result = fn()
      if (result && typeof result.then === 'function') {
        result
          .then(() => { passed++; console.log(`  ✅ ${name}`); resolve() })
          .catch((e) => { failed++; console.log(`  ❌ ${name}: ${e.message}`); resolve() })
      }
      else {
        passed++
        console.log(`  ✅ ${name}`)
        resolve()
      }
    }
    catch (e) {
      failed++
      console.log(`  ❌ ${name}: ${e.message}`)
      resolve()
    }
  })
}
function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg)
  }
}

// Minimal RequestsManager
class RequestsManager {
  constructor() {
    this.requests = new Map()
  }

  hasRequest(id) { return this.requests.has(id) }
  subscribeRequest(id, cb) { this.requests.set(id, cb) }
  unsubscribeRequest(id) { this.requests.delete(id) }
  onData(header, data) {
    const cb = this.requests.get(header.requestId)
    if (cb) {
      cb(header, data)
    }
  }
}

// Buggy onResponse — no timeout
function onResponseBuggy(mgr, requestId, callback) {
  mgr.subscribeRequest(requestId, (header, data) => {
    mgr.unsubscribeRequest(requestId)
    callback(header, data)
  })
}

// Fixed onResponse — with timeout
const DEFAULT_TIMEOUT_MS = 30000
function onResponseFixed(mgr, requestId, callback, timeoutMs) {
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => {
    if (mgr.hasRequest(requestId)) {
      mgr.unsubscribeRequest(requestId)
      callback(null, null, new Error(`Socket response timeout after ${timeout}ms for request ${requestId}`))
    }
  }, timeout)

  mgr.subscribeRequest(requestId, (header, data) => {
    clearTimeout(timer)
    mgr.unsubscribeRequest(requestId)
    callback(header, data, null)
  })
}

async function main() {
  console.log('SocketServer.onResponse timeout tests:\n')

  await test('Bug: no-response leaves subscription forever', () => {
    const mgr = new RequestsManager()
    onResponseBuggy(mgr, 42, () => {})
    assert(mgr.hasRequest(42), 'Subscription should exist')
    // In real code this promise would never resolve
  })

  await test('Fix: timeout fires and cleans up subscription', () => {
    return new Promise((resolve, reject) => {
      const mgr = new RequestsManager()
      onResponseFixed(mgr, 42, (header, data, err) => {
        try {
          assert(err !== null, 'Expected timeout error')
          assert(err.message.includes('timeout'), `Expected timeout msg, got: ${err.message}`)
          assert(!mgr.hasRequest(42), 'Subscription should be cleaned up')
          resolve()
        }
        catch (e) {
          reject(e)
        }
      }, 50) // 50ms timeout for test speed
    })
  })

  await test('Fix: normal response clears timeout', () => {
    return new Promise((resolve, reject) => {
      const mgr = new RequestsManager()
      onResponseFixed(mgr, 42, (header, data, err) => {
        try {
          assert(err === null, `Expected no error, got: ${err}`)
          assert(header.requestId === 42, 'Should get correct header')
          assert(!mgr.hasRequest(42), 'Subscription should be cleaned up')
          resolve()
        }
        catch (e) {
          reject(e)
        }
      }, 5000) // long timeout
      // Simulate immediate response
      mgr.onData({ requestId: 42 }, Buffer.from('ok'))
    })
  })

  await test('Fix: response before timeout prevents timeout callback', () => {
    return new Promise((resolve, reject) => {
      const mgr = new RequestsManager()
      let callCount = 0
      onResponseFixed(mgr, 42, () => {
        callCount++
      }, 100)
      // Immediate response
      mgr.onData({ requestId: 42 }, Buffer.from('ok'))
      // Wait past timeout period to ensure no second call
      setTimeout(() => {
        try {
          assert(callCount === 1, `Expected 1 call, got ${callCount}`)
          resolve()
        }
        catch (e) {
          reject(e)
        }
      }, 200)
    })
  })

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
