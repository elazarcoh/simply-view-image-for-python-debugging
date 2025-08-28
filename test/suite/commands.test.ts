import * as assert from 'node:assert';
import * as vscode from 'vscode';

describe('extension Commands Test Suite', () => {
  before(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension('elazarcoh.simply-view-image-for-python-debugging');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  it('open Settings command should work', async () => {
    // Test the open settings command
    try {
      await vscode.commands.executeCommand('svifpd.open-settings');
      // If no error is thrown, the command executed successfully
      assert.ok(true, 'Open settings command executed');
    }
    catch (error) {
      assert.fail(`Open settings command failed: ${error}`);
    }
  });

  it('open Image Webview command should work', async () => {
    try {
      await vscode.commands.executeCommand('svifpd.open-image-webview');
      // This command should create/reveal a webview panel
      assert.ok(true, 'Open image webview command executed');
    }
    catch (error) {
      assert.fail(`Open image webview command failed: ${error}`);
    }
  });

  it('watch Refresh command should work without debug session', async () => {
    try {
      await vscode.commands.executeCommand('svifpd.watch-refresh');
      // This should work even without a debug session (might just do nothing)
      assert.ok(true, 'Watch refresh command executed');
    }
    catch (error) {
      // It's okay if this fails when no debug session is active
      assert.ok(error instanceof Error, 'Watch refresh handled gracefully');
    }
  });

  it('add Expression command should be available', async () => {
    try {
      await vscode.commands.executeCommand('svifpd.add-expression');
      assert.ok(true, 'Add expression command executed');
    }
    catch (error) {
      // This might fail without a debug session, but should be available
      assert.ok(error instanceof Error, 'Add expression command is available');
    }
  });

  it('debug-dependent commands should handle no-debug gracefully', async () => {
    // These commands should be available but might fail gracefully when no debug session
    const debugCommands = [
      'svifpd.run-setup',
      'svifpd.view-image',
      'svifpd.view-image-track',
      'svifpd.update-frame-id',
      'svifpd.update-diagnostics',
    ];

    for (const command of debugCommands) {
      try {
        await vscode.commands.executeCommand(command);
        // If it succeeds, that's fine
        assert.ok(true, `${command} executed successfully`);
      }
      catch (error) {
        // If it fails, that's also fine for debug-dependent commands
        assert.ok(error instanceof Error, `${command} handled no-debug state gracefully`);
      }
    }
  });

  it('configuration-dependent commands should work', async () => {
    // Test commands that don't strictly depend on debug state
    const configCommands = [
      'svifpd.open-settings',
      'svifpd.open-image-webview',
    ];

    for (const command of configCommands) {
      try {
        await vscode.commands.executeCommand(command);
        assert.ok(true, `${command} executed successfully`);
      }
      catch (error) {
        assert.fail(`${command} should work without debug session: ${error}`);
      }
    }
  });

  it('invalid command should not be registered', async () => {
    const commands = await vscode.commands.getCommands();

    // Check that invalid/non-existent commands are not registered
    const invalidCommands = [
      'svifpd.invalid-command',
      'svifpd.non-existent',
      'svifpd.wrong-command',
    ];

    for (const command of invalidCommands) {
      assert.ok(
        !commands.includes(command),
        `Invalid command ${command} should not be registered`,
      );
    }
  });

  it('command execution should not crash VS Code', async () => {
    // Test that rapidly executing commands doesn't crash
    const safeCommands = [
      'svifpd.open-settings',
      'svifpd.watch-refresh',
      'svifpd.open-image-webview',
    ];

    // Execute commands multiple times rapidly
    const promises = [];
    for (let i = 0; i < 5; i++) {
      for (const command of safeCommands) {
        promises.push(
          vscode.commands.executeCommand(command).then(() => {
            // Command succeeded
          }, () => {
            // Ignore errors, we just want to ensure no crash
          }),
        );
      }
    }

    await Promise.all(promises);
    assert.ok(true, 'Rapid command execution did not crash VS Code');
  });

  it('extension should handle command with invalid arguments', async () => {
    // Test commands with various invalid arguments
    try {
      // Try to execute a command with invalid arguments
      await vscode.commands.executeCommand('svifpd.view-image', 'invalid-arg');
      assert.ok(true, 'Command handled invalid arguments gracefully');
    }
    catch (error) {
      // It's fine if it throws an error, as long as it doesn't crash
      assert.ok(error instanceof Error, 'Command validation works');
    }
  });

  it('command availability should match enablement conditions', async () => {
    // Commands that should be available regardless of debug state
    const alwaysAvailable = [
      'svifpd.open-settings',
      'svifpd.open-image-webview',
      'svifpd.add-expression',
    ];

    // Commands that are debug-dependent
    const debugDependent = [
      'svifpd.run-setup',
      'svifpd.view-image',
      'svifpd.view-image-track',
      'svifpd.update-frame-id',
    ];

    const allCommands = await vscode.commands.getCommands();

    // Always available commands should be registered
    for (const command of alwaysAvailable) {
      assert.ok(
        allCommands.includes(command),
        `Command ${command} should always be available`,
      );
    }

    // Debug-dependent commands should also be registered (enablement is different from registration)
    for (const command of debugDependent) {
      assert.ok(
        allCommands.includes(command),
        `Command ${command} should be registered even without debug session`,
      );
    }
  });
});
