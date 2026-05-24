import * as path from 'node:path';
import { TitleBar, VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { openWorkspaceFile } from './test-utils';

export const WORKSPACE_DIR = path.join(__dirname, '../../..', 'tests/test-data/workspace');
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, '.vscode', 'tests.code-workspace');

/**
 * Waits for the test workspace to be open in VS Code.
 *
 * In CI, the workspace is passed as a VS Code startup argument via the VSCODE_OPEN_WORKSPACE
 * env variable (read by our patched vscode-extension-tester browser.js), so VS Code starts
 * with the workspace already loaded. We just need to wait for the title bar to reflect this.
 *
 * For local development without VSCODE_OPEN_WORKSPACE set, falls back to opening via
 * workbench.action.openWorkspace (which requires Quick Input — works on local VS Code
 * but not on VS Code 1.116+ Linux CI where the dialog is native/GTK).
 */
export async function openWorkspace(
  workspaceFile: string = WORKSPACE_FILE,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    initialWait?: number;
    verifyTimeout?: number;
    pollInterval?: number;
  } = {},
) {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    initialWait = 3000,
    verifyTimeout = 20000,
    pollInterval = 500,
  } = options;
  const workspaceName = path.basename(WORKSPACE_FILE, '.code-workspace');

  // Poll for the workspace to already be open. In CI, VS Code starts with the workspace
  // passed as a startup argument, so this should succeed quickly.
  const alreadyOpen = await VSBrowser.instance.driver.wait(
    async () => {
      try {
        const title = await new TitleBar().getTitle();
        if (title.startsWith(workspaceName)) {
          DebugTestHelper.logger.success(`Workspace already open: "${title}"`);
          return true;
        }
      }
      catch (_e) {
        // ignore, keep polling
      }
      return false;
    },
    verifyTimeout,
    undefined,
    pollInterval,
  ).catch(() => false);

  if (alreadyOpen) {
    return;
  }

  // Fallback: try opening via dialog (works on local VS Code with Quick Input).
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      DebugTestHelper.logger.step(`Opening workspace (attempt ${attempt}/${maxRetries})`);
      await openWorkspaceFile(workspaceFile);

      await VSBrowser.instance.driver.sleep(initialWait);

      const isWorkspaceReady = await VSBrowser.instance.driver.wait(async () => {
        const titleBar = new TitleBar();
        const title = await titleBar.getTitle();
        return title.startsWith(workspaceName);
      }, verifyTimeout, `Workspace title did not match "${workspaceName}"`, pollInterval);

      if (isWorkspaceReady) {
        DebugTestHelper.logger.success(`Workspace opened successfully on attempt ${attempt}`);
        return;
      }
    }
    catch (error) {
      DebugTestHelper.logger.warn(`Workspace open attempt ${attempt} failed: ${error}`);

      if (attempt === maxRetries) {
        const titleBar = new TitleBar();
        const currentTitle = await titleBar.getTitle().catch(() => '[Unable to get title]');
        throw new Error(
          `Failed to open workspace after ${maxRetries} attempts. `
          + `Expected title to start with "${workspaceName}", but got "${currentTitle}"`,
        );
      }

      await VSBrowser.instance.driver.sleep(retryDelay);
    }
  }
}

export function fileInWorkspace(filePath: string) {
  return path.join(WORKSPACE_DIR, filePath);
}
