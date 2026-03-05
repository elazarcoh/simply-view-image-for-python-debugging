/**
 * MVP end-to-end test: verifies the core workflow of the extension.
 * Opens a Python file, starts debugging, hits a breakpoint, views a variable
 * as an image, and verifies the webview opens.
 */

import { expect } from 'chai';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('core image viewing workflow', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    await openWorkspace();

    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
      autoEnsureViews: true,
    });
  }).timeout(60000);

  after(async () => {
    DebugTestHelper.reset();
  });

  afterEach(async () => {
    if (debugHelper) {
      await debugHelper.cleanup();
    }
  }).timeout(20000);

  it('should view a numpy image variable and open the webview', async () => {
    debugHelper.setCurrentTest('mvp-view-image');

    // Open file and start debugging
    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('debug_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    // Expand Image Watch and verify it has items
    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // Perform "View Image" on variable x
    await debugHelper.performVariableAction({
      variableName: 'x',
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 3,
      type: 'variable',
    });

    // Wait for the webview to open and assert it did
    await debugHelper.getWebview({ autoOpen: true });
    const webviewEditor = await debugHelper.getWebviewEditor();
    expect(webviewEditor).to.not.be.undefined;

    const isDisplayed = await webviewEditor.isDisplayed();
    expect(isDisplayed).to.be.true;

    await debugHelper.takeScreenshot({
      name: 'webview-opened',
      element: webviewEditor,
    });

    DebugTestHelper.logger.success('MVP test: numpy image viewed successfully');
  }).timeout(120000);

  it('should show variables in Image Watch section during debugging', async () => {
    debugHelper.setCurrentTest('mvp-watch-items');

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('numpy_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // Verify we can find the Variables container
    const variablesItem = await debugHelper.findAndExpandTreeItem('Variables');
    expect(variablesItem).to.not.be.undefined;

    // Verify we can perform an action on a variable (proves variables are populated)
    await debugHelper.performVariableAction({
      variableName: 'rgb_image',
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 3,
      type: 'variable',
    });

    await debugHelper.takeScreenshot({
      name: 'image-watch-populated',
      element: 'screen',
    });

    DebugTestHelper.logger.success('MVP test: Image Watch populated with variables');
  }).timeout(120000);
});
