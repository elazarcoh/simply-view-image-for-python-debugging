/**
 * Expression-focused debugging test using DebugTestHelper
 * This test demonstrates adding and working with expressions
 */

import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('python expression debugging tests', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    console.log('Step: Opening workspace for expression tests');
    await openWorkspace();
    console.log('Step: Workspace opened');

    // Initialize the debug helper
    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
    });
  }).timeout(30000);

  afterEach(async () => {
    // Clean up after tests
    if (debugHelper) {
      await debugHelper.cleanup();
    }
  });

  after(async () => {
    DebugTestHelper.reset();
  });

  it('should be able to add and evaluate various expressions', async () => {
    try {
      debugHelper.log('Starting comprehensive expression test');
      await debugHelper.setupEditorForDebug({
        fileName: fileInWorkspace('debug_test.py'),
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      await debugHelper.startDebugging();
      await debugHelper.expandImageWatchSection();

      // Add multiple expressions for testing
      const scaledExpression = '(x * 0.5).astype(np.uint8)';
      await debugHelper.addExpression({
        expression: scaledExpression,
      });
      const reshapedExpression = 'x.reshape(4, 3)';
      await debugHelper.addExpression({
        expression: reshapedExpression,
      });
      await debugHelper.wait(2000);
      await debugHelper.refreshImageWatch();

      // Try to view the reshaped array (most likely to be viewable as image)
      try {
        await debugHelper.performVariableAction({
          variableName: reshapedExpression,
          actionLabel: 'View Image',
          retrySetup: true,
          setupRetries: 3,
          type: 'expression',
        });
        const webviewEditor = await debugHelper.getWebviewEditor();
        await debugHelper.takeScreenshot({
          name: 'expression-reshaped-test',
          element: webviewEditor,
        });
      }
      catch (error) {
        console.log('Note: Could not view reshaped expression as image:', error);
        // Take a screenshot of the current state anyway
        await debugHelper.takeScreenshot({
          name: 'error-reshaped-expression-missing',
          element: 'screen',
        });
      }

      // Try to view the scaled array
      try {
        await debugHelper.performVariableAction({
          variableName: scaledExpression,
          actionLabel: 'View Image',
          retrySetup: true,
          setupRetries: 3,
          type: 'expression',
        });
        const webviewEditor = await debugHelper.getWebviewEditor();
        await debugHelper.takeScreenshot({
          name: 'expression-scaled-test',
          element: webviewEditor,
        });
      }
      catch (error) {
        console.log('Note: Could not view scaled expression as image:', error);
        // Take a screenshot of the current state anyway
        await debugHelper.takeScreenshot({
          name: 'error-scaled-expression-missing',
          element: 'screen',
        });
      }

      // Clean up
      debugHelper.log('Comprehensive expression test completed');
    }
    catch (err) {
      console.error('Expression test failed:', err);
      throw err;
    }
  }).timeout(90000);
});
