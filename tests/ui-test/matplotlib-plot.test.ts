/**
 * Matplotlib plot viewing test: verifies that matplotlib figures
 * can be viewed using the "View Plot" action.
 */

import { expect } from 'chai';
import { EditorView, Workbench } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';

describe('matplotlib plot viewing', () => {
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

  it('should view a matplotlib figure in the webview', async () => {
    debugHelper.setCurrentTest('plot-view');

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('matplotlib_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.sleep(2000);

    // Explicitly run setup to ensure matplotlib figures are detected
    await new Workbench().executeCommand('svifpd.run-setup');
    await debugHelper.sleep(2000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.refreshImageWatch();
    await debugHelper.waitForImageWatchItems({ timeout: 15000, minItems: 1 });

    // View the line plot figure — use more retries since matplotlib detection
    // may need additional setup calls to recognize Figure objects
    await debugHelper.performVariableAction({
      variableName: 'fig_line',
      actionLabel: 'View Plot',
      retrySetup: true,
      setupRetries: 5,
      type: 'variable',
    });

    // "View Plot" renders the figure as a PNG and opens it in an editor tab
    // (not the "Image View" webview). Verify the PNG editor tab opened.
    await debugHelper.sleep(3000);

    const editorView = new EditorView();
    const groups = await editorView.getEditorGroups();
    const allTitles: string[] = [];
    for (const group of groups) {
      const titles = await group.getOpenEditorTitles();
      allTitles.push(...titles);
    }

    const plotTabOpen = allTitles.some(t => t.includes('fig_line'));
    expect(plotTabOpen).to.be.true;

    await debugHelper.takeScreenshot({
      name: 'matplotlib-line-plot',
      element: 'screen',
    });

    DebugTestHelper.logger.success('Plot test: matplotlib figure viewed successfully');
  }).timeout(120000);
});
