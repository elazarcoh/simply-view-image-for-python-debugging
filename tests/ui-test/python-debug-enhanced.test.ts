/**
 * Python debugging test demonstrating enhanced DebugTestHelper with auto-ensuring and high-level methods
 */

import { DebugTestHelper } from './DebugTestHelper';
import { openWorkspace } from './globals';

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
    // Enhanced cleanup after tests
    if (debugHelper) {
      await debugHelper.cleanup();
    }
    DebugTestHelper.reset();
  });

  it('should set up editor for debug and inspect variables using high-level methods', async () => {
    try {
      debugHelper.log('Starting enhanced debug test with high-level methods');

      // Use the high-level setup method
      await debugHelper.setupEditorForDebug({
        fileName: 'debug_test.py',
        breakpointLines: [15], // Add breakpoint at line 15
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      // Start complete debug session (this will auto-ensure views)
      await debugHelper.startDebugging();
      await debugHelper.waitForBreakpoint();

      // Use auto-ensuring methods - these will automatically open/expand required views
      await debugHelper.performVariableAction({
        variableName: 'x',
        actionLabel: 'View Image',
        retrySetup: true,
        setupRetries: 3,
      });

      // Get webview with auto-opening
      await debugHelper.getWebview({ autoOpen: true });

      // Take screenshot (will auto-ensure webview is open)
      await debugHelper.takeScreenshot({
        name: 'enhanced-test-webview',
        elementType: 'webview',
      });

      console.log('✓ Enhanced debug test completed successfully');
    }
    catch (error) {
      console.error('❌ Enhanced debug test failed:', error);
      throw error;
    }
  }).timeout(120000);

  it('should demonstrate complete debug session high-level method', async () => {
    try {
      debugHelper.log('Testing complete debug session method');

      // Use the highest-level method that does everything
      await debugHelper.startCompleteDebugSession({
        fileName: 'debug_test.py',
        breakpointLines: [15],
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      // Now we can directly work with variables - views are already set up
      await debugHelper.performVariableAction({
        variableName: 'x',
        actionLabel: 'View Image',
      });

      // Webview should be available
      await debugHelper.getWebview();
      await debugHelper.takeScreenshot({
        name: 'complete-session-test',
        elementType: 'webview',
      });

      console.log('✓ Complete debug session test completed successfully');
    }
    catch (error) {
      console.error('❌ Complete debug session test failed:', error);
      throw error;
    }
  }).timeout(120000);

  it('should handle view validation and auto-recovery', async () => {
    try {
      debugHelper.log('Testing view validation and auto-recovery');

      // This test demonstrates that methods work even if views are not set up
      // The helper will automatically ensure they are opened/expanded

      // Direct call without manual setup - should auto-ensure debug view
      await debugHelper.selectLaunchConfiguration('Python: Current File');

      // Direct call without manual setup - should auto-ensure image watch section
      await debugHelper.refreshImageWatch();

      // Direct call without manual setup - should auto-ensure webview is available
      await debugHelper.takeScreenshot({
        name: 'auto-recovery-test',
        elementType: 'webview',
      });

      console.log('✓ View validation and auto-recovery test completed successfully');
    }
    catch (error) {
      console.error('❌ View validation test failed:', error);
      throw error;
    }
  }).timeout(120000);
});
