import * as path from 'node:path';
import { TitleBar, VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { openWorkspaceFile } from './test-utils';

export const WORKSPACE_DIR = path.join(__dirname, '../../..', 'tests/test-data/workspace');
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, '.vscode', 'tests.code-workspace');

/**
 * Opens a workspace with retry logic for improved robustness in CI/headless environments.
 * @param workspaceFile - Path to the workspace file (defaults to test workspace)
 * @param options - Configuration options for retry behavior
 * @param options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param options.retryDelay - Delay in ms between retries (default: 2000)
 * @param options.initialWait - Initial wait time in ms after opening (default: 3000)
 */
export async function openWorkspace(
  workspaceFile: string = WORKSPACE_FILE,
  options: { maxRetries?: number; retryDelay?: number; initialWait?: number } = {},
) {
  const { maxRetries = 3, retryDelay = 2000, initialWait = 3000 } = options;
  const workspaceName = path.basename(WORKSPACE_FILE, '.code-workspace');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      DebugTestHelper.logger.step(`Opening workspace (attempt ${attempt}/${maxRetries})`);
      await openWorkspaceFile(workspaceFile);

      // Wait for workspace to fully load - use longer initial wait for stability
      await VSBrowser.instance.driver.sleep(initialWait);

      // Verify workspace is opened by checking title with retry
      const isWorkspaceReady = await VSBrowser.instance.driver.wait(async () => {
        const titleBar = new TitleBar();
        const title = await titleBar.getTitle();
        return title.startsWith(workspaceName);
      }, 10000, `Workspace title did not match "${workspaceName}"`, 500);

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

      // Wait before retrying
      await VSBrowser.instance.driver.sleep(retryDelay);
    }
  }
}

export function fileInWorkspace(filePath: string) {
  return path.join(WORKSPACE_DIR, filePath);
}
