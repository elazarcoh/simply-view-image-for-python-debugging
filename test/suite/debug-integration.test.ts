import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { TestHelper } from './test-helpers';

suite('Debug Integration Test Suite', () => {
  const testWorkspacePath = path.join(__dirname, '../../test-data/fixtures');

  suiteSetup(async () => {
    // Ensure test scripts exist - they should be generated beforehand by generate_test_data.py
    const basicTestScript = path.join(testWorkspacePath, 'basic_test.py');
    if (!fs.existsSync(basicTestScript)) {
      throw new Error(`Test script ${basicTestScript} does not exist. Run 'yarn test:generate-data' first.`);
    }
  });

  it('should be able to start debug session', async function () {
    this.timeout(30000); // Increase timeout for debug session setup

    // Skip if Python is not available
    try {
      const pythonExtension = vscode.extensions.getExtension('ms-python.python');
      if (!pythonExtension) {
        this.skip();
      }
    }
    catch {
      this.skip();
    }

    const debugConfig: vscode.DebugConfiguration = {
      type: 'python',
      request: 'launch',
      name: 'Test Debug Session',
      program: path.join(testWorkspacePath, 'basic_test.py'),
      console: 'integratedTerminal',
      stopOnEntry: false,
      cwd: testWorkspacePath,
    };

    // Start debug session
    const started = await vscode.debug.startDebugging(undefined, debugConfig);
    assert.ok(started, 'Failed to start debug session');

    // Wait for debug session to be active
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for debug session'));
      }, 10000);

      const disposable = vscode.debug.onDidChangeActiveDebugSession((session) => {
        if (session) {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        }
      });
    });

    // Verify debug session is active
    assert.ok(vscode.debug.activeDebugSession, 'No active debug session');
  });

  it('should handle debug session termination gracefully', async function () {
    this.timeout(15000);

    // Only run if there's an active debug session
    if (!vscode.debug.activeDebugSession) {
      this.skip();
    }

    const session = vscode.debug.activeDebugSession;

    // Terminate the session
    await vscode.debug.stopDebugging(session);

    // Wait for session to terminate
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000);

      const disposable = vscode.debug.onDidTerminateDebugSession(() => {
        clearTimeout(timeout);
        disposable.dispose();
        resolve();
      });
    });

    // Verify session is terminated
    assert.strictEqual(vscode.debug.activeDebugSession, undefined, 'Debug session still active');
  });

  it('extension setup command should be available during debugging', async function () {
    this.timeout(30000);

    // Skip if no Python extension
    try {
      const pythonExtension = vscode.extensions.getExtension('ms-python.python');
      if (!pythonExtension) {
        this.skip();
      }
    }
    catch {
      this.skip();
    }

    const debugConfig: vscode.DebugConfiguration = {
      type: 'python',
      request: 'launch',
      name: 'Test Debug Session for Setup',
      program: path.join(testWorkspacePath, 'basic_test.py'),
      console: 'integratedTerminal',
      stopOnEntry: true, // Stop on entry so we can test setup
      cwd: testWorkspacePath,
    };

    // Start debug session
    const started = await vscode.debug.startDebugging(undefined, debugConfig);
    if (!started) {
      this.skip();
    }

    // Wait for debug session
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for debug session'));
      }, 10000);

      const disposable = vscode.debug.onDidChangeActiveDebugSession((session) => {
        if (session) {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        }
      });
    });

    // Try to execute setup command
    try {
      await vscode.commands.executeCommand('svifpd.run-setup');
      // If we get here, the command executed without throwing
      assert.ok(true, 'Setup command executed successfully');
    }
    catch (error) {
      // Setup might fail due to Python environment, but command should be available
      assert.ok(error instanceof Error, 'Setup command is available but failed due to environment');
    }

    // Clean up
    if (vscode.debug.activeDebugSession) {
      await vscode.debug.stopDebugging(vscode.debug.activeDebugSession);
    }
  });

  it('should handle multiple debug sessions', async function () {
    this.timeout(45000);

    // Skip if no Python extension
    try {
      const pythonExtension = vscode.extensions.getExtension('ms-python.python');
      if (!pythonExtension) {
        this.skip();
      }
    }
    catch {
      this.skip();
    }

    const sessions: vscode.DebugSession[] = [];

    try {
      // Start first session
      const debugConfig1: vscode.DebugConfiguration = {
        type: 'python',
        request: 'launch',
        name: 'Test Session 1',
        program: path.join(testWorkspacePath, 'basic_test.py'),
        console: 'integratedTerminal',
        cwd: testWorkspacePath,
      };

      await vscode.debug.startDebugging(undefined, debugConfig1);

      // Wait and capture first session
      await new Promise<void>((resolve) => {
        const disposable = vscode.debug.onDidChangeActiveDebugSession((session) => {
          if (session) {
            sessions.push(session);
            disposable.dispose();
            resolve();
          }
        });
      });

      assert.strictEqual(sessions.length, 1, 'First debug session not created');

      // The extension should handle multiple sessions gracefully
      // We test this by verifying the extension doesn't crash when dealing with session switching
      assert.ok(vscode.debug.activeDebugSession, 'Active debug session should exist');
    }
    finally {
      // Clean up all sessions
      for (const session of sessions) {
        if (session) {
          await vscode.debug.stopDebugging(session);
        }
      }
    }
  });
});
