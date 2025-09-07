/**
 * Python debugging test demonstrating enhanced DebugTestHelper with auto-ensuring and high-level methods
 */

import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('python debugging with enhanced DebugTestHelper', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    console.log('Step: Opening workspace');
    await openWorkspace();
    console.log('Step: Workspace opened');

    // Initialize the debug helper with auto-ensuring enabled
    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
      autoEnsureViews: true, // Enable auto-ensuring of views
    });
  }).timeout(30000);

  after(async () => {
    DebugTestHelper.reset();
  });

  afterEach(async () => {
    // Reset state after each test to ensure isolation
    if (debugHelper) {
      await debugHelper.cleanup();
    }
  }).timeout(20000);

  it('should set up editor for debug and inspect variables using high-level methods', async () => {
    try {
      debugHelper.log('Starting enhanced debug test with high-level methods');

      // Use the high-level setup method
      await debugHelper.setupEditorForDebug({
        fileName: fileInWorkspace('debug_test.py'),
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      // Start complete debug session (this will auto-ensure views)
      await debugHelper.startDebugging();
      await debugHelper.waitForBreakpoint();

      await debugHelper.sleep(1000);

      // Use auto-ensuring methods - these will automatically open/expand required views
      await debugHelper.performVariableAction({
        variableName: 'x',
        actionLabel: 'View Image',
        retrySetup: true,
        setupRetries: 3,
        type: 'variable',
      });

      // Get webview with auto-opening
      await debugHelper.getWebview({ autoOpen: true });

      // Take screenshot (will auto-ensure webview is open)
      const webviewEditor = await debugHelper.getWebviewEditor();
      await debugHelper.takeScreenshot({
        name: 'enhanced-test-webview',
        element: webviewEditor,
      });

      console.log('✓ Enhanced debug test completed successfully');
    }
    catch (error) {
      console.error('❌ Enhanced debug test failed:', error);
      await debugHelper.takeScreenshot({ name: 'enhanced-test-error', element: 'screen' });
      throw error;
    }
  }).timeout(120000);

  it('should demonstrate complete debug session high-level method', async () => {
    try {
      debugHelper.log('Testing complete debug session method');

      // Use the highest-level method that does everything
      await debugHelper.startCompleteDebugSession({
        fileName: fileInWorkspace('debug_test.py'),
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      // Now we can directly work with variables - views are already set up
      await debugHelper.performVariableAction({
        variableName: 'x',
        actionLabel: 'View Image',
        type: 'variable',
      });

      // Webview should be available
      await debugHelper.getWebview();
      const webviewEditor = await debugHelper.getWebviewEditor();
      await debugHelper.takeScreenshot({
        name: 'complete-session-test',
        element: webviewEditor,
      });

      console.log('✓ Complete debug session test completed successfully');
    }
    catch (error) {
      console.error('❌ Complete debug session test failed:', error);
      await debugHelper.takeScreenshot({ name: 'complete-session-error', element: 'screen' });
      throw error;
    }
  }).timeout(120000);
});
