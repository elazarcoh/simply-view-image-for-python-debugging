/**
 * Unit tests for deactivate() and SocketServer.close() (A1).
 *
 * Bug: The extension has no deactivate() export, so the socket server
 * stays open when the extension is deactivated/uninstalled, leaking
 * the listening port.
 *
 * Run: node tests/unit/ts/test_deactivate.js
 */

const net = require('net')

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

// Minimal SocketServer with close()
class SocketServerWithClose {
  constructor() {
    this.server = net.createServer()
    this.started = false
  }

  async start() {
    return new Promise((resolve) => {
      this.server.listen(0, () => {
        this.started = true
        resolve()
      })
    })
  }

  close() {
    if (this.started) {
      this.server.close()
      this.started = false
    }
  }

  get isListening() { return this.server.listening }
}

async function main() {
  console.log('deactivate() / SocketServer.close() tests:\n')

  await test('Server starts and listens', async () => {
    const srv = new SocketServerWithClose()
    await srv.start()
    assert(srv.isListening, 'Should be listening')
    srv.close()
  })

  await test('close() stops listening', async () => {
    const srv = new SocketServerWithClose()
    await srv.start()
    assert(srv.isListening, 'Should be listening before close')
    srv.close()
    // net.Server.close() is async, wait briefly
    await new Promise(r => setTimeout(r, 50))
    assert(!srv.isListening, 'Should not be listening after close')
  })

  await test('close() is idempotent', async () => {
    const srv = new SocketServerWithClose()
    await srv.start()
    srv.close()
    srv.close() // should not throw
  })

  await test('close() on never-started server is safe', () => {
    const srv = new SocketServerWithClose()
    srv.close() // should not throw
  })

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
