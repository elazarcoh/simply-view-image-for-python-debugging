/**
 * Expression-focused debugging test using DebugTestHelper
 * This test demonstrates adding and working with expressions
 */

import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('python expression debugging tests', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    DebugTestHelper.logger.step('Opening workspace for expression tests');
    await openWorkspace();
    DebugTestHelper.logger.step('Workspace opened');

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
    debugHelper.setCurrentTest('expr-eval'); // Short name: expr-eval

    const testContext = {
      currentStep: 'initialization',
      testName: 'expr-eval',
    };

    await runTestWithErrorHandling(testContext, async () => {
      DebugTestHelper.logger.testStart('Starting comprehensive expression test');

      testContext.currentStep = 'editor-setup';
      await debugHelper.setupEditorForDebug({
        fileName: fileInWorkspace('debug_test.py'),
        debugConfig: 'Python: Current File',
        openFile: true,
      });

      testContext.currentStep = 'debug-start';
      await debugHelper.startDebugging();

      testContext.currentStep = 'expand-image-watch';
      await debugHelper.expandImageWatchSection();

      await addExpressionsForTesting();

      testContext.currentStep = 'wait-and-refresh';
      await debugHelper.wait(2000);
      await debugHelper.refreshImageWatch();

      await attemptViewExpression('reshaped', 'x.reshape(4, 3)', testContext);
      await attemptViewExpression('scaled', '(x * 0.5).astype(np.uint8)', testContext);

      testContext.currentStep = 'cleanup';
      DebugTestHelper.logger.success('Comprehensive expression test completed');
    });

    async function addExpressionsForTesting(): Promise<void> {
      testContext.currentStep = 'add-scaled-expression';
      const scaledExpression = '(x * 0.5).astype(np.uint8)';
      await debugHelper.addExpression({
        expression: scaledExpression,
      });

      testContext.currentStep = 'add-reshaped-expression';
      const reshapedExpression = 'x.reshape(4, 3)';
      await debugHelper.addExpression({
        expression: reshapedExpression,
      });
    }

    async function attemptViewExpression(
      expressionType: string,
      expression: string,
      context: { currentStep: string; testName: string },
    ): Promise<void> {
      context.currentStep = `view-${expressionType}-expression`;

      try {
        await debugHelper.performVariableAction({
          variableName: expression,
          actionLabel: 'View Image',
          retrySetup: true,
          setupRetries: 3,
          type: 'expression',
        });

        context.currentStep = `screenshot-${expressionType}-webview`;
        const webviewEditor = await debugHelper.getWebviewEditor();
        await debugHelper.takeScreenshot({
          name: `expression-${expressionType}-test`,
          element: webviewEditor,
        });
        DebugTestHelper.logger.success(`Successfully viewed ${expressionType} expression as image`);
      }
      catch (error) {
        DebugTestHelper.logger.info(`Could not view ${expressionType} expression as image: ${error}`);
        await handleExpressionViewError(expressionType, context);
      }
    }

    async function handleExpressionViewError(
      expressionType: string,
      context: { currentStep: string; testName: string },
    ): Promise<void> {
      await debugHelper.takeScreenshot({
        name: `error-${expressionType}-expression-missing-step-${context.currentStep}`,
        element: 'screen',
      });

      try {
        const debugStateInfo = await debugHelper.getDebugStateInfo();
        debugStateInfo.forEach(info => DebugTestHelper.logger.info(`Debug state (${expressionType} failure): ${info}`));
      }
      catch (stateError) {
        DebugTestHelper.logger.warn(`Failed to get debug state: ${stateError}`);
      }
    }

    async function runTestWithErrorHandling(
      context: { currentStep: string; testName: string },
      testFunction: () => Promise<void>,
    ): Promise<void> {
      try {
        await testFunction();
      }
      catch (err) {
        DebugTestHelper.logger.error(`Expression test failed at step "${context.currentStep}": ${err}`);
        await captureComprehensiveErrorState(context);
        throw err;
      }
    }

    async function captureComprehensiveErrorState(context: { currentStep: string; testName: string }): Promise<void> {
      await debugHelper.takeScreenshot({
        name: `expression-test-error-at-${context.currentStep}`,
        element: 'screen',
      });

      try {
        const debugStateInfo = await debugHelper.getDebugStateInfo();
        debugStateInfo.forEach(info => DebugTestHelper.logger.info(`Debug state (error): ${info}`));

        await debugHelper.takeScreenshot({
          name: `expression-test-debug-state-${context.currentStep}`,
          element: 'screen',
        });
      }
      catch (stateError) {
        DebugTestHelper.logger.warn(`Failed to capture debug state on error: ${stateError}`);
      }
    }
  }).timeout(90000);
});
