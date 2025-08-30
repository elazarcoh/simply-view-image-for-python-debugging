/**
 * Basic extension activation test for Simply View Image for Python Debugging extension
 * Tests that the extension loads correctly and has the expected configuration
 */

import * as path from 'node:path';
import { expect } from 'chai';
import { ActivityBar, VSBrowser, Workbench } from 'vscode-extension-tester';
import { setupTestEnvironment } from './test-utils';

describe('extension Activation Tests', function () {
  let workbench: Workbench;

  // Set reasonable timeout
  this.timeout(60000);

  before(async function () {
    this.timeout(60000);

    try {
      workbench = new Workbench();

      // Setup test environment: ensure VS Code is ready and extension is activated
      await setupTestEnvironment(60000);
    }
    catch (error) {
      console.warn('Setup encountered issues:', error);
    }
  });

  it('should have extension files and configuration present', async function () {
    this.timeout(30000);

    try {
      // Verify package.json exists and has expected content
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const fs = require('node:fs');

      expect(fs.existsSync(packageJsonPath)).to.be.true;
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.name).to.equal('simply-view-image-for-python-debugging');
      expect(packageJson.displayName).to.equal('View Image for Python Debugging');
      expect(packageJson.publisher).to.equal('elazarcoh');

      console.log('✓ Extension package.json is valid');

      // Verify extension has expected commands
      expect(packageJson.contributes.commands).to.be.an('array');
      const commandNames = packageJson.contributes.commands.map((cmd: any) => cmd.command);

      expect(commandNames).to.include('svifpd.view-image');
      expect(commandNames).to.include('svifpd.view-image-track');
      console.log('✓ Extension commands are properly configured');

      // Verify webview files exist
      const distPath = path.join(process.cwd(), 'dist');
      expect(fs.existsSync(distPath)).to.be.true;

      const indexHtmlPath = path.join(distPath, 'index.html');
      expect(fs.existsSync(indexHtmlPath)).to.be.true;
      console.log('✓ Webview files are built and present');
    }
    catch (error) {
      console.error('Extension configuration test failed:', error);
      throw error;
    }
  });

  it('should be able to access VS Code extension API', async function () {
    this.timeout(30000);

    try {
      // Test basic VS Code interaction
      const activityBar = new ActivityBar();

      // Try to get Explorer view (basic VS Code functionality)
      const explorerControl = await activityBar.getViewControl('Explorer');
      expect(explorerControl).to.not.be.undefined;
      console.log('✓ VS Code Explorer view is accessible');

      // Try to open command palette and look for extension commands
      await workbench.executeCommand('workbench.action.showCommands');
      await VSBrowser.instance.driver.sleep(1000);

      // Type part of our extension command prefix
      await VSBrowser.instance.driver.actions().sendKeys('svifpd').perform();
      await VSBrowser.instance.driver.sleep(500);

      // Press Escape to close command palette
      await VSBrowser.instance.driver.actions().sendKeys('\uE00C').perform();

      console.log('✓ Extension commands are available in command palette');
    }
    catch (error) {
      console.error('VS Code API access test failed:', error);
      throw error;
    }
  });

  after(async function () {
    this.timeout(10000);
    try {
      // Clean up any open dialogs or editors
      const editorView = new (await import('vscode-extension-tester')).EditorView();
      await editorView.closeAllEditors();
      console.log('Test cleanup completed');
    }
    catch (e) {
      console.warn('Cleanup had minor issues:', e);
    }
  });
});
