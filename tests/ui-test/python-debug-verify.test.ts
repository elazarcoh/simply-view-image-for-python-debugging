/**
 * Python debugging functionality verification test
 * This test verifies the Python debugging components without requiring UI automation
 */

import type { DebugView, TreeItem } from 'vscode-extension-tester';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect } from 'chai';
import { set } from 'lodash';
import { ActivityBar, DebugToolbar, EditorView, InputBox, Key, VSBrowser, Workbench } from 'vscode-extension-tester';
import { ensureImageWatchSectionExpanded, openEditor, openFile, openWorkspace, waitForImageWebviewToOpen } from './test-utils';

describe('python Debugging Components', () => {
  before(async function () {
    this.timeout(9999999);

    // open the $cwd/python_test/debug_test.py file
    const filePath = path.join(process.cwd(), 'python_test', '.vscode', 'workspace.code-workspace');
    await openWorkspace(filePath);
    await VSBrowser.instance.driver.sleep(500);
  });

  it('should have a valid Python test script', () => {
    const pythonTestFile = path.join(process.cwd(), 'python_test', 'debug_test.py');

    // Verify file exists
    expect(fs.existsSync(pythonTestFile)).to.be.true;

    // Verify content
    const content = fs.readFileSync(pythonTestFile, 'utf8');
    expect(content).to.include('x = ');
    expect(content).to.include('breakpoint()');
    expect(content).to.include('def main():');
    expect(content).to.include('if __name__ == "__main__":');

    console.log('✓ Python test script is valid and contains required debugging elements');
  });

  it('should have proper debug configuration', () => {
    const launchConfigFile = path.join(process.cwd(), 'python_test', '.vscode', 'launch.json');

    // Verify launch.json exists
    expect(fs.existsSync(launchConfigFile)).to.be.true;

    // Verify configuration content
    const configContent = fs.readFileSync(launchConfigFile, 'utf8');
    const config = JSON.parse(configContent);

    expect(config.version).to.equal('0.2.0');
    expect(config.configurations).to.be.an('array');
    expect(config.configurations.length).to.be.greaterThan(0);

    // Verify Python configuration exists
    const pythonConfig = config.configurations.find((cfg: any) => ['python', 'debugpy'].includes(cfg.type));
    expect(pythonConfig).to.not.be.undefined;
    expect(pythonConfig.request).to.equal('launch');
    expect(pythonConfig.name).to.include('Python');

    console.log('✓ Debug configuration is properly set up for Python debugging');
  });

  it('should be able to put a break point, start debug, and inspect the variable', async () => {
    await openFile('debug_test.py');

    // go to line
    // const workbench = new Workbench();
    // await workbench.executeCommand('Go to Line');
    // await VSBrowser.instance.driver.sleep(500);
    // const inputBox = await InputBox.create();
    // await inputBox.setText(':10');
    // await inputBox.confirm();
    // await VSBrowser.instance.driver.sleep(500);
    // // add breakpoint using command
    // await workbench.executeCommand('Debug: Toggle Breakpoint');

    // Open the debug panel
    const btn = await new ActivityBar().getViewControl('Run');
    if (!btn) {
      throw new Error('Could not find Run and Debug view');
    }
    const debugView = (await btn.openView()) as DebugView;

    // get titles of all available launch configurations
    const configs = await debugView.getLaunchConfigurations();
    const configName = configs.find(c => c.startsWith('Python: Current File'));
    if (!configName) {
      throw new Error('Could not find Python: Debug Test Script configuration');
    }
    // select launch configuration by title
    await debugView.selectLaunchConfiguration(configName);

    // start selected launch configuration
    await debugView.start();
    await VSBrowser.instance.driver.sleep(3000);

    // wait for the bar to show up to 5 seconds, check every second
    const bar = await DebugToolbar.create();
    const isDisplayed = VSBrowser.instance.driver.wait(async () => {
      return bar.isDisplayed();
    }, 5000, 'Debug toolbar did not appear in time', 1000);
    if (!isDisplayed) {
      throw new Error('Debug toolbar did not appear in time');
    }

    // wait for breakpoints to be hit
    await bar.waitForBreakPoint(3000);

    const imageViewSection = await ensureImageWatchSectionExpanded();
    if (!imageViewSection) {
      throw new Error('Image Watch section is not available');
    }
    // wait a few seconds after expansion
    await VSBrowser.instance.driver.sleep(2000);

    // expand the 'x' variable under 'Variables'
    const variablesItem = (await imageViewSection.findItem('Variables')) as TreeItem | undefined;
    if (!variablesItem) {
      throw new Error('Variables item is not available');
    }
    const xItem = (await variablesItem.findChildItem('x')) as TreeItem | undefined;
    if (!xItem) {
      throw new Error('x item is not available');
    }
    const buttons = await xItem.getActionButtons();
    for (const btn of buttons) {
      const label = await btn.getLabel();
      if (label === 'View Image') {
        await btn.click();
        break;
      }
    }
    await waitForImageWebviewToOpen();

    // take screenshot
    await VSBrowser.instance.driver.sleep(2000);
    await VSBrowser.instance.takeScreenshot('test');
  });
});
