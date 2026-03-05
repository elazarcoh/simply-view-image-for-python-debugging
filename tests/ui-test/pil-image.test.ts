/**
 * PIL/Pillow image viewing test: verifies that PIL Image objects
 * can be viewed through the extension.
 */

import { expect } from 'chai';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('pillow image viewing', () => {
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

  it('should view a PIL RGB image in the webview', async () => {
    debugHelper.setCurrentTest('pil-rgb');

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('pil_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // View the PIL RGB image
    await debugHelper.performVariableAction({
      variableName: 'pil_rgb',
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 3,
      type: 'variable',
    });

    await debugHelper.getWebview({ autoOpen: true });
    const webviewEditor = await debugHelper.getWebviewEditor();
    expect(webviewEditor).to.not.be.undefined;

    const isDisplayed = await webviewEditor.isDisplayed();
    expect(isDisplayed).to.be.true;

    await debugHelper.takeScreenshot({
      name: 'pil-rgb-viewed',
      element: webviewEditor,
    });

    DebugTestHelper.logger.success('PIL test: RGB image viewed successfully');
  }).timeout(120000);

  it('should show PIL images in the Image Watch variables list', async () => {
    debugHelper.setCurrentTest('pil-watch');

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('pil_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // Verify the Variables container exists (PIL images should be detected)
    const variablesItem = await debugHelper.findAndExpandTreeItem('Variables');
    expect(variablesItem).to.not.be.undefined;

    await debugHelper.takeScreenshot({
      name: 'pil-watch-items',
      element: 'screen',
    });

    DebugTestHelper.logger.success('PIL test: images visible in Image Watch');
  }).timeout(120000);
});
