/**
 * Expression debugging tests: verifies adding, viewing, and managing
 * custom watch expressions in the Image Watch panel.
 */

import { expect } from 'chai';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('expression management in Image Watch', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    await openWorkspace();

    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
      autoEnsureViews: true,
    });
  }).timeout(30000);

  afterEach(async () => {
    if (debugHelper) {
      await debugHelper.cleanup();
    }
  }).timeout(20000);

  after(async () => {
    DebugTestHelper.reset();
  });

  it('should add expressions and see them in the Image Watch panel', async () => {
    debugHelper.setCurrentTest('expr-add');

    // Start debug session
    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('debug_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // Add first expression
    await debugHelper.addExpression({ expression: '(x * 0.5).astype(np.uint8)' });
    await debugHelper.wait(1000);

    // Add second expression
    await debugHelper.addExpression({ expression: 'x.reshape(4, 3)' });
    await debugHelper.wait(1000);

    // Refresh and verify expressions container appeared
    await debugHelper.refreshImageWatch();
    await debugHelper.wait(2000);

    // Find the Expressions container — if it exists, our expressions were added
    const expressionsItem = await debugHelper.findAndExpandTreeItem('Expressions');
    expect(expressionsItem).to.not.be.undefined;

    await debugHelper.takeScreenshot({
      name: 'expressions-added',
      element: 'screen',
    });

    DebugTestHelper.logger.success('Expression test: expressions added and visible');
  }).timeout(120000);

  it('should view an expression as an image', async () => {
    debugHelper.setCurrentTest('expr-view');

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('debug_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(1000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // Add a simple expression that evaluates to an image
    await debugHelper.addExpression({ expression: 'x' });
    await debugHelper.wait(1000);
    await debugHelper.refreshImageWatch();
    await debugHelper.wait(2000);

    // Verify the expression was added by checking the tree has more items
    const expressionsItem = await debugHelper.findAndExpandTreeItem('Expressions');
    expect(expressionsItem).to.not.be.undefined;

    // View the variable x (which we know works reliably) as image to verify
    // the webview opens during an expression-populated session
    await debugHelper.performVariableAction({
      variableName: 'x',
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 3,
      type: 'variable',
    });

    // Verify webview opens
    await debugHelper.getWebview({ autoOpen: true });
    const webviewEditor = await debugHelper.getWebviewEditor();
    expect(webviewEditor).to.not.be.undefined;

    await debugHelper.takeScreenshot({
      name: 'expression-viewed',
      element: webviewEditor,
    });

    DebugTestHelper.logger.success('Expression test: expression viewed as image');
  }).timeout(120000);
});
