/**
 * Python debugging test demonstrating enhanced DebugTestHelper with auto-ensuring and high-level methods
 */

import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('python debugging with enhanced DebugTestHelper', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    DebugTestHelper.logger.step('Opening workspace');
    await openWorkspace();
    DebugTestHelper.logger.step('Workspace opened');

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
    debugHelper.setCurrentTest('mvp-setup'); // Short name: mvp-setup

    const testContext = {
      currentStep: 'initialization',
      testName: 'mvp-setup',
    };

    await runTestWithErrorHandling(testContext, async () => {
      DebugTestHelper.logger.testStart('Starting enhanced debug test with high-level methods');

      testContext.currentStep = 'editor-setup';
      await debugHelper.setupEditorForDebug({
        fileName: fileInWorkspace('debug_test.py'),
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      testContext.currentStep = 'debug-start';
      await debugHelper.startDebugging();

      testContext.currentStep = 'breakpoint-wait';
      await debugHelper.waitForBreakpoint();
      await debugHelper.sleep(1000);

      testContext.currentStep = 'variable-action';
      await debugHelper.performVariableAction({
        variableName: 'x',
        actionLabel: 'View Image',
        retrySetup: true,
        setupRetries: 3,
        type: 'variable',
      });

      testContext.currentStep = 'webview-get';
      await debugHelper.getWebview({ autoOpen: true });

      testContext.currentStep = 'webview-editor-get';
      const webviewEditor = await debugHelper.getWebviewEditor();

      testContext.currentStep = 'final-screenshot';
      await debugHelper.takeScreenshot({
        name: 'enhanced-test-webview',
        element: webviewEditor,
      });

      DebugTestHelper.logger.success('Enhanced debug test completed successfully');
    });
  }).timeout(120000);

  // it('should demonstrate complete debug session high-level method', async () => {
  //   debugHelper.setCurrentTest('mvp-session'); // Short name: mvp-session

  //   const testContext = {
  //     currentStep: 'initialization',
  //     testName: 'mvp-session',
  //   };

  //   await runTestWithErrorHandling(testContext, async () => {
  //     debugHelper.log('Testing complete debug session method');

  //     testContext.currentStep = 'complete-session-start';
  //     await debugHelper.startCompleteDebugSession({
  //       fileName: fileInWorkspace('debug_test.py'),
  // debugHelper.logger.info('Starting enhanced debug test with high-level methods');
  //       openFile: true,
  //     });

  //     testContext.currentStep = 'variable-action';
  //     await debugHelper.performVariableAction({
  //       variableName: 'x',
  //       actionLabel: 'View Image',
  //       type: 'variable',
  //     });

  //     testContext.currentStep = 'webview-get';
  //     await debugHelper.getWebview();

  //     testContext.currentStep = 'webview-editor-get';
  //     const webviewEditor = await debugHelper.getWebviewEditor();

  //     testContext.currentStep = 'final-screenshot';
  //     await debugHelper.takeScreenshot({
  //       name: 'complete-session-test',
  //       element: webviewEditor,
  //     });

  //     DebugTestHelper.logger.success('✓ Complete debug session test completed successfully');
  //   });
  // }).timeout(120000);

  async function runTestWithErrorHandling(
    context: { currentStep: string; testName: string },
    testFunction: () => Promise<void>,
  ): Promise<void> {
    try {
      await testFunction();
    }
    catch (error) {
      DebugTestHelper.logger.error(`${context.testName} test failed at step "${context.currentStep}": ${error}`);
      await captureErrorState(context);
      throw error;
    }
  }

  async function captureErrorState(context: { currentStep: string; testName: string }): Promise<void> {
    await debugHelper.takeScreenshot({
      name: `${context.testName}-error-at-${context.currentStep}`,
      element: 'screen',
    });

    try {
      DebugTestHelper.logger.info('Attempting to capture debug state...');
      const debugStateInfo = await debugHelper.getDebugStateInfo();
      debugStateInfo.forEach(info => DebugTestHelper.logger.info(`Debug state: ${info}`));

      await debugHelper.takeScreenshot({
        name: `debug-state-${context.currentStep}`,
        element: 'screen',
      });
    }
    catch (stateError) {
      DebugTestHelper.logger.warn(`Failed to capture debug state: ${stateError}`);
    }
  }
});
