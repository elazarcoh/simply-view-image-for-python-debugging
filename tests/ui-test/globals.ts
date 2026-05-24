import * as path from 'node:path';
import { Key, TitleBar, VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { openWorkspaceFile } from './test-utils';

export const WORKSPACE_DIR = path.join(__dirname, '../../..', 'tests/test-data/workspace');
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, '.vscode', 'tests.code-workspace');

// After the overlay is dismissed once it won't reappear — skip polling on subsequent calls.
let overlayAlreadyDismissed = false;

/**
 * Dismisses VS Code onboarding/walkthrough overlay modals that block all UI.
 * These appear as `<div class="onboarding-a-overlay visible">` (full-screen modal,
 * intercepts all clicks). The overlay loads asynchronously after startup — we poll.
 * Safe to call when no overlay is present (no-op, and fast on subsequent calls).
 */
export async function dismissVSCodeOverlays(): Promise<void> {
  const driver = VSBrowser.instance.driver;
  try {
    if (overlayAlreadyDismissed) {
      // Quick check only — skip the 8s poll since overlay won't reappear
      const els = await driver.findElements({ css: '.onboarding-a-overlay.visible' });
      if (els.length === 0) {
        return;
      }
      // Overlay reappeared (shouldn't happen) — fall through to dismiss it
    }
    else {
      // First call: poll up to 8s — the overlay appears asynchronously after workspace loads
      await driver.wait(
        async () => {
          const els = await driver.findElements({ css: '.onboarding-a-overlay.visible' });
          return els.length > 0;
        },
        8000,
        undefined,
        500,
      ).catch(() => null); // Timeout just means overlay didn't appear — that's fine
    }

    const overlays = await driver.findElements({ css: '.onboarding-a-overlay.visible' });
    overlayAlreadyDismissed = true;
    if (overlays.length === 0) {
      return; // No overlay
    }

    DebugTestHelper.logger.info('Dismissing VS Code onboarding overlay...');

    // Use JS to find and click the close button inside the overlay;
    // the button is in native DOM (the webview inside shows sign-in content).
    const dismissed = await driver.executeScript<boolean>(`
      const overlay = document.querySelector('.onboarding-a-overlay.visible');
      if (!overlay) return false;
      const selectors = [
        'button[aria-label="Close"]',
        '.dialog-close-button',
        '.close-button',
        'button.codicon-close',
        '.codicon-close',
      ];
      for (const sel of selectors) {
        const btn = overlay.querySelector(sel);
        if (btn) { btn.click(); return true; }
      }
      return false;
    `);

    if (!dismissed) {
      // Fall back: send Escape via the active element (focus is trapped in the dialog,
      // so this reaches whichever button/webview VS Code has focused inside the overlay).
      await driver.actions().sendKeys(Key.ESCAPE).perform();
      DebugTestHelper.logger.info('Dismissed overlay via Escape (no close button found in native DOM)');
    }
    else {
      DebugTestHelper.logger.info('Dismissed overlay via close button');
    }

    await driver.sleep(500);
  }
  catch (_e) {
    // Overlay absent or already dismissed
  }
}

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
    await dismissVSCodeOverlays();
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
        await dismissVSCodeOverlays();
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
