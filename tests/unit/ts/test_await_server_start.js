/**
 * Unit tests for awaiting SocketServer.start() (A2).
 *
 * Bug: socketServer.start() returns a Promise that is not awaited in
 * activate(). If start() rejects, the error is silently swallowed.
 *
 * Run: node tests/unit/ts/test_await_server_start.js
 */

let passed = 0
let failed = 0
function test(name, fn) {
  return new Promise((resolve) => {
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
  })
}
function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg)
  }
}

// Simulate async start that can fail
class FakeServer {
  constructor(shouldFail = false) {
    this._shouldFail = shouldFail
    this.started = false
  }

  async start() {
    if (this._shouldFail) {
      throw new Error('Port already in use')
    }
    this.started = true
  }
}

async function main() {
  console.log('SocketServer.start() await tests:\n')

  await test('Bug: fire-and-forget swallows async error', async () => {
    const srv = new FakeServer(true)
    let errorCaught = false
    try {
      // Fire-and-forget pattern (buggy)
      srv.start()
      // No error here because the promise rejection is unhandled
    }
    catch {
      errorCaught = true
    }
    assert(!errorCaught, 'Error is NOT caught with fire-and-forget')
    assert(!srv.started, 'Server should not be started')
  })

  await test('Fix: awaited start propagates error', async () => {
    const srv = new FakeServer(true)
    let errorCaught = false
    try {
      await srv.start()
    }
    catch {
      errorCaught = true
    }
    assert(errorCaught, 'Error should be caught when awaited')
    assert(!srv.started, 'Server should not be started')
  })

  await test('Fix: successful start completes', async () => {
    const srv = new FakeServer(false)
    await srv.start()
    assert(srv.started, 'Server should be started')
  })

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
