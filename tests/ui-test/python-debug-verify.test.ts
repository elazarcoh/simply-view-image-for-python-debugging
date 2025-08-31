/**
 * Python debugging functionality verification test
 * This test verifies the Python debugging components without requiring UI automation
 */

import type { Button, DebugView, Editor, TreeItem } from 'vscode-extension-tester';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect } from 'chai';
import { ActivityBar, DebugToolbar, EditorView, VSBrowser, WebView, Workbench } from 'vscode-extension-tester';
import { fileInWorkspace, openWorkspace, WORKSPACE_DIR } from './globals';
import { ensureImageWatchSectionExpanded, getOpenedImageWebview as getOpenedImageWebviewTab, openEditor, openFile, waitForImageWebviewToOpen, writeScreenshot } from './test-utils';

describe('python Debugging Components', () => {
  before(async () => {
    console.log('Step: Opening workspace');
    await openWorkspace();
    console.log('Step: Workspace opened');
  }).timeout(30000);

  // it('should have a valid Python test script', () => {
  //   const pythonTestFile = path.join(process.cwd(), 'python_test', 'debug_test.py');

  //   // Verify file exists
  //   expect(fs.existsSync(pythonTestFile)).to.be.true;

  //   // Verify content
  //   const content = fs.readFileSync(pythonTestFile, 'utf8');
  //   expect(content).to.include('x = ');
  //   expect(content).to.include('breakpoint()');
  //   expect(content).to.include('def main():');
  //   expect(content).to.include('if __name__ == "__main__":');

  //   console.log('✓ Python test script is valid and contains required debugging elements');
  // });

  // it('should have proper debug configuration', () => {
  //   const launchConfigFile = path.join(process.cwd(), 'python_test', '.vscode', 'launch.json');

  //   // Verify launch.json exists
  //   expect(fs.existsSync(launchConfigFile)).to.be.true;

  //   // Verify configuration content
  //   const configContent = fs.readFileSync(launchConfigFile, 'utf8');
  //   const config = JSON.parse(configContent);

  //   expect(config.version).to.equal('0.2.0');
  //   expect(config.configurations).to.be.an('array');
  //   expect(config.configurations.length).to.be.greaterThan(0);

  //   // Verify Python configuration exists
  //   const pythonConfig = config.configurations.find((cfg: any) => ['python', 'debugpy'].includes(cfg.type));
  //   expect(pythonConfig).to.not.be.undefined;
  //   expect(pythonConfig.request).to.equal('launch');
  //   expect(pythonConfig.name).to.include('Python');

  //   console.log('✓ Debug configuration is properly set up for Python debugging');
  // });

  it('should be able to put a break point, start debug, and inspect the variable', async () => {
    try {
      console.log('Step: Opening debug_test.py');
      await openEditor(fileInWorkspace('debug_test.py'));
      console.log('Step: File opened');
      await VSBrowser.instance.driver.sleep(1000);

      console.log('Step: Opening editor');
      const editor = await new EditorView().openEditor('debug_test.py');
      if (!editor.isDisplayed()) {
        console.error('Editor is not displayed');
        throw new Error('Editor is not displayed');
      }
      console.log('Step: Editor is displayed');

      console.log('Step: Opening debug panel');
      const btn = await new ActivityBar().getViewControl('Run');
      if (!btn) {
        console.error('Could not find Run and Debug view');
        throw new Error('Could not find Run and Debug view');
      }
      const debugView = (await btn.openView()) as DebugView;
      console.log('Step: Debug panel opened');

      console.log('Step: Getting launch configurations');
      const configs = await debugView.getLaunchConfigurations();
      const configName = configs.find(c => c.startsWith('Python: Current File'));
      if (!configName) {
        console.error('Could not find Python: Debug Test Script configuration');
        throw new Error('Could not find Python: Debug Test Script configuration');
      }
      console.log('Step: Launch configuration found:', configName);
      await debugView.selectLaunchConfiguration(configName);
      console.log('Step: Launch configuration selected');

      console.log('Step: Starting debug');
      await debugView.start();
      await VSBrowser.instance.driver.sleep(3000);
      console.log('Step: Debug started');

      console.log('Step: Waiting for debug toolbar');
      const bar = await DebugToolbar.create();
      const isDisplayed = VSBrowser.instance.driver.wait(async () => {
        return bar.isDisplayed();
      }, 5000, 'Debug toolbar did not appear in time', 1000);
      if (!isDisplayed) {
        console.error('Debug toolbar did not appear in time');
        throw new Error('Debug toolbar did not appear in time');
      }
      console.log('Step: Debug toolbar is displayed');

      console.log('Step: Waiting for breakpoints to be hit');
      await bar.waitForBreakPoint(3000);
      console.log('Step: Breakpoint hit');

      console.log('Step: Expanding Image Watch section');
      const imageViewSection = await ensureImageWatchSectionExpanded();
      if (!imageViewSection) {
        console.error('Image Watch section is not available');
        throw new Error('Image Watch section is not available');
      }
      console.log('Step: Image Watch section expanded');
      await VSBrowser.instance.driver.sleep(2000);

      const refreshButton = await imageViewSection.getAction('Refresh');
      if (!refreshButton) {
        console.error('Refresh button is not available');
        throw new Error('Refresh button is not available');
      }
      console.log('Step: Refresh button found');

      console.log('Step: Expanding Variables item');
      const variablesItem = (await imageViewSection.findItem('Variables')) as TreeItem | undefined;
      if (!variablesItem) {
        console.error('Variables item is not available');
        throw new Error('Variables item is not available');
      }
      console.log('Step: Variables item expanded');

      // try 5 times, each time refresh with `svifpd.watch-refresh`
      console.log('Step: Expanding x item');
      let xItem;
      for (let i = 0; i < 5; i++) {
        xItem = (await variablesItem.findChildItem('x')) as TreeItem | undefined;
        if (xItem) {
          break;
        }
        await (new Workbench()).executeCommand('svifpd.run-setup');
        await VSBrowser.instance.driver.sleep(1000);
        await refreshButton.click();
        await VSBrowser.instance.driver.sleep(1000);
      }
      if (!xItem) {
        console.error('x item is not available');
        throw new Error('x item is not available');
      }
      console.log('Step: x item expanded');

      console.log('Step: Getting action buttons for x');
      const buttons = await xItem.getActionButtons();
      for (const btn of buttons) {
        const label = await btn.getLabel();
        console.log('Step: Found button label:', label);
        if (label === 'View Image') {
          console.log('Step: Clicking View Image button');
          await btn.click();
          break;
        }
      }
      console.log('Step: Waiting for image webview to open');
      const webviewTab = await getOpenedImageWebviewTab();
      if (!webviewTab) {
        console.error('Image webview is not open');
        throw new Error('Image webview is not open');
      }
      const editorView = new EditorView();
      let webviewEditor: Editor | undefined;
      for (const group of await editorView.getEditorGroups()) {
        const titles = await group.getOpenEditorTitles();
        if (titles.includes('Image View')) {
          webviewEditor = await group.openEditor('Image View');
          if (webviewEditor) {
            break;
          }
        }
      }
      if (!webviewEditor) {
        console.error('Image View editor is not open');
        throw new Error('Image View editor is not open');
      }
      await VSBrowser.instance.driver.sleep(1000);

      console.log('Step: Taking screenshot');
      const screenShot = await webviewEditor.takeScreenshot();
      await writeScreenshot(screenShot, 'image');
      console.log('Step: Screenshot taken');

      // stop the debugger
      await bar.stop();
      await VSBrowser.instance.driver.sleep(2000);
    }
    catch (err) {
      console.error('Test failed:', err);
      throw err;
    }
  }).timeout(60000);
});
