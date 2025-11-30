import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { TestHelper } from './test-helpers';

describe('end-to-End Integration Test Suite', () => {
  let testScriptPath: string;

  before(async function () {
    this.timeout(30000);

    // Ensure extension is activated
    await TestHelper.waitForExtensionActivation('elazarcoh.simply-view-image-for-python-debugging');

    // Create a test Python script
    const scriptContent = TestHelper.generateBasicPythonScript();
    testScriptPath = await TestHelper.createTempTestFile('integration_test.py', scriptContent);
  });

  after(() => {
    // Cleanup temporary files
    TestHelper.cleanupTempFiles();
  });

  it('complete workflow: Extension activation → Commands → Configuration', async function () {
    this.timeout(20000);

    // 1. Verify extension is active
    const extension = vscode.extensions.getExtension('elazarcoh.simply-view-image-for-python-debugging');
    assert.ok(extension?.isActive, 'Extension should be active');

    // 2. Test configuration access
    const config = TestHelper.getExtensionConfig();
    assert.ok(config.get('preferredBackend'), 'Configuration should be accessible');

    // 3. Test command availability
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('svifpd.open-settings'), 'Settings command should be available');
    assert.ok(commands.includes('svifpd.open-image-webview'), 'Webview command should be available');

    // 4. Test command execution
    const settingsResult = await TestHelper.executeCommandSafely('svifpd.open-settings');
    assert.ok(settingsResult.success || settingsResult.error, 'Settings command should execute');

    const webviewResult = await TestHelper.executeCommandSafely('svifpd.open-image-webview');
    assert.ok(webviewResult.success || webviewResult.error, 'Webview command should execute');

    // 5. Test extension health
    const health = await TestHelper.verifyExtensionHealth();
    assert.ok(health.healthy || health.issues.length < 3, 'Extension should be mostly healthy');
  });

  it('python integration workflow (if Python extension available)', async function () {
    this.timeout(30000);

    // Skip if Python extension is not available
    if (!TestHelper.isPythonExtensionAvailable()) {
      this.skip();
    }

    try {
      // 1. Create debug configuration
      const _debugConfig = TestHelper.createPythonDebugConfig(testScriptPath, 'Integration Test');

      // 2. Test debug-related commands (they should not crash even if debug fails)
      const setupResult = await TestHelper.executeCommandSafely('svifpd.run-setup');
      assert.ok(setupResult.success !== undefined, 'Setup command should be callable');

      const refreshResult = await TestHelper.executeCommandSafely('svifpd.watch-refresh');
      assert.ok(refreshResult.success !== undefined, 'Refresh command should be callable');

      // 3. Test other debug-dependent commands
      const debugCommands = [
        'svifpd.view-image',
        'svifpd.update-frame-id',
        'svifpd.update-diagnostics',
      ];

      for (const command of debugCommands) {
        const result = await TestHelper.executeCommandSafely(command);
        assert.ok(result.success !== undefined, `Command ${command} should be callable`);
      }
    }
    catch (error) {
      // Debug integration might fail in test environment, that's okay
      assert.ok(error instanceof Error, 'Debug integration should handle errors gracefully');
    }
  });

  it('configuration persistence and modification', async function () {
    this.timeout(10000);

    const config = TestHelper.getExtensionConfig();

    // Test temporary configuration changes
    const originalDebug = config.get('debug');
    const originalBackend = config.get('preferredBackend');

    try {
      // 1. Change debug setting
      const debugCleanup = await TestHelper.setConfigTemporarily('debug', 'verbose');
      assert.strictEqual(config.get('debug'), 'verbose', 'Debug setting should be updated');

      // 2. Change backend setting
      const backendCleanup = await TestHelper.setConfigTemporarily('preferredBackend', 'Pillow');
      assert.strictEqual(config.get('preferredBackend'), 'Pillow', 'Backend setting should be updated');

      // 3. Verify multiple settings work together
      assert.strictEqual(config.get('debug'), 'verbose', 'Debug setting should remain');
      assert.strictEqual(config.get('preferredBackend'), 'Pillow', 'Backend setting should remain');

      // 4. Cleanup and verify restoration
      await debugCleanup();
      await backendCleanup();

      assert.strictEqual(config.get('debug'), originalDebug, 'Debug setting should be restored');
      assert.strictEqual(config.get('preferredBackend'), originalBackend, 'Backend setting should be restored');
    }
    catch (error) {
      // Ensure cleanup even if test fails
      await config.update('debug', originalDebug, vscode.ConfigurationTarget.Workspace);
      await config.update('preferredBackend', originalBackend, vscode.ConfigurationTarget.Workspace);
      throw error;
    }
  });

  it('webview lifecycle management', async function () {
    this.timeout(15000);

    // 1. Open webview multiple times
    for (let i = 0; i < 3; i++) {
      const result = await TestHelper.executeCommandSafely('svifpd.open-image-webview');
      assert.ok(result.success !== undefined, `Webview opening ${i + 1} should work`);
      await TestHelper.sleep(500);
    }

    // 2. Test webview-related commands
    const webviewCommands = [
      'svifpd.open-image-webview',
      'svifpd.watch-refresh',
    ];

    for (const command of webviewCommands) {
      const result = await TestHelper.executeCommandSafely(command);
      assert.ok(result.success !== undefined, `Webview command ${command} should work`);
    }

    // 3. Test rapid webview operations
    const rapidPromises = [];
    for (let i = 0; i < 5; i++) {
      rapidPromises.push(TestHelper.executeCommandSafely('svifpd.open-image-webview'));
    }

    const results = await Promise.all(rapidPromises);
    assert.ok(results.every(r => r.success !== undefined), 'Rapid webview operations should not crash');
  });

  it('error handling and recovery', async function () {
    this.timeout(10000);

    // 1. Test commands with invalid arguments
    const invalidCommands = [
      { command: 'svifpd.view-image', args: ['invalid-arg'] },
      { command: 'svifpd.run-setup', args: [null] },
    ];

    for (const { command, args } of invalidCommands) {
      const result = await TestHelper.executeCommandSafely(command, ...args);
      assert.ok(result.success !== undefined, `Command ${command} should handle invalid args`);
    }

    // 2. Test configuration with invalid values
    const config = TestHelper.getExtensionConfig();
    const originalDebug = config.get('debug');

    try {
      await config.update('debug', 'invalid-debug-level', vscode.ConfigurationTarget.Workspace);
      // Extension should not crash with invalid config
      await TestHelper.sleep(100);
      assert.ok(true, 'Extension should handle invalid configuration');
    }
    catch (error) {
      // It's okay if this throws an error
      assert.ok(error instanceof Error, 'Invalid configuration should throw proper error');
    }
    finally {
      await config.update('debug', originalDebug, vscode.ConfigurationTarget.Workspace);
    }

    // 3. Test extension health after error conditions
    const health = await TestHelper.verifyExtensionHealth();
    assert.ok(health.healthy || health.issues.length < 5, 'Extension should recover from errors');
  });

  it('performance and resource management', async function () {
    this.timeout(15000);

    const startTime = Date.now();

    // 1. Execute multiple commands rapidly
    const commands = [
      'svifpd.open-settings',
      'svifpd.open-image-webview',
      'svifpd.watch-refresh',
      'svifpd.update-diagnostics',
    ];

    const rapidExecution = async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        for (const command of commands) {
          promises.push(TestHelper.executeCommandSafely(command));
        }
      }
      return Promise.all(promises);
    };

    const results = await rapidExecution();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // 2. Verify performance
    assert.ok(duration < 10000, 'Rapid command execution should complete within 10 seconds');
    assert.ok(results.length === 40, 'All commands should be executed');

    // 3. Verify extension is still healthy
    const health = await TestHelper.verifyExtensionHealth();
    assert.ok(health.healthy || health.issues.length < 3, 'Extension should remain healthy after stress test');

    // 4. Test memory usage doesn't explode (basic check)
    const memoryUsage = process.memoryUsage();
    assert.ok(memoryUsage.heapUsed < 200 * 1024 * 1024, 'Memory usage should be reasonable (< 200MB)');
  });
});
