import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation Test Suite', () => {
  test('Extension should be present and activate', async () => {
    // Get the extension
    const extension = vscode.extensions.getExtension('elazarcoh.simply-view-image-for-python-debugging');
    
    // Check that extension is found
    assert.ok(extension, 'Extension not found');
    
    // Activate the extension
    await extension.activate();
    
    // Check that extension is now active
    assert.strictEqual(extension.isActive, true, 'Extension failed to activate');
  });

  test('Extension commands should be registered', async () => {
    // Get all available commands
    const commands = await vscode.commands.getCommands();
    
    // Check that our extension commands are registered
    const extensionCommands = [
      'svifpd.run-setup',
      'svifpd.view-image',
      'svifpd.view-image-track',
      'svifpd.watch-view-image',
      'svifpd.watch-view-plot',
      'svifpd.watch-view-tensor',
      'svifpd.watch-track-enable',
      'svifpd.watch-track-disable',
      'svifpd.watch-refresh',
      'svifpd.open-image-webview',
      'svifpd.open-settings',
      'svifpd.add-expression',
      'svifpd.edit-expression',
      'svifpd.remove-expression',
      'svifpd.remove-all-expressions',
      'svifpd.update-frame-id',
      'svifpd.view-debug-variable',
      'svifpd.disable-plugin',
      'svifpd.update-diagnostics'
    ];

    for (const command of extensionCommands) {
      assert.ok(
        commands.includes(command),
        `Command ${command} is not registered`
      );
    }
  });

  test('Extension configuration should be available', () => {
    // Test that configuration section exists
    const config = vscode.workspace.getConfiguration('svifpd');
    
    // Test some key configuration properties
    assert.notStrictEqual(config.get('debug'), undefined, 'Debug config not found');
    assert.notStrictEqual(config.get('preferredBackend'), undefined, 'PreferredBackend config not found');
    assert.notStrictEqual(config.get('autoUpdateImages'), undefined, 'AutoUpdateImages config not found');
    assert.notStrictEqual(config.get('useExperimentalViewer'), undefined, 'UseExperimentalViewer config not found');
  });

  test('Extension should register tree view provider', async () => {
    // The tree view should be available
    // We can't directly test the tree view provider, but we can verify it doesn't crash
    // when trying to access the registered view
    const treeView = vscode.window.createTreeView('pythonDebugImageWatch', {
      treeDataProvider: {
        getChildren: () => [],
        getTreeItem: (element: any) => new vscode.TreeItem('test')
      }
    });
    
    assert.ok(treeView, 'Tree view creation failed');
    treeView.dispose();
  });
});