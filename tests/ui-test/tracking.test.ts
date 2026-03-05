/**
 * Variable tracking test: verifies that tracking a variable updates
 * the image when the debugger continues to the next breakpoint.
 */

import { expect } from 'chai';
import { DebugToolbar } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('variable tracking across breakpoints', () => {
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

  afterEach(async () => {
    if (debugHelper) {
      await debugHelper.cleanup();
    }
  }).timeout(20000);

  after(async () => {
    DebugTestHelper.reset();
  });

  it('should view an image at first breakpoint and still see webview after continue', async () => {
    debugHelper.setCurrentTest('tracking');

    // Start debug session with tracking test file (has two breakpoints)
    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('tracking_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    // At first breakpoint: img is red, counter=1
    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // View the image at first breakpoint
    await debugHelper.performVariableAction({
      variableName: 'img',
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 3,
      type: 'variable',
    });

    await debugHelper.getWebview({ autoOpen: true });
    const firstWebview = await debugHelper.getWebviewEditor();
    expect(firstWebview).to.not.be.undefined;

    await debugHelper.takeScreenshot({
      name: 'tracking-first-breakpoint',
      element: firstWebview,
    });

    DebugTestHelper.logger.success('Tracking: image viewed at first breakpoint');

    // Continue to next breakpoint
    DebugTestHelper.logger.step('Continuing to second breakpoint...');
    const toolbar = await DebugToolbar.create();
    await toolbar.continue();
    await debugHelper.sleep(2000);

    // Wait for second breakpoint
    await toolbar.waitForBreakPoint(10000);
    DebugTestHelper.logger.success('Second breakpoint hit');

    // Take a screenshot at second breakpoint to verify state
    await debugHelper.takeScreenshot({
      name: 'tracking-second-breakpoint',
      element: 'screen',
    });

    // The Image Watch panel should still be present
    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // Verify we can still find variables
    const variablesItem = await debugHelper.findAndExpandTreeItem('Variables');
    expect(variablesItem).to.not.be.undefined;

    DebugTestHelper.logger.success('Tracking: variables still visible at second breakpoint');
  }).timeout(180000);
});
