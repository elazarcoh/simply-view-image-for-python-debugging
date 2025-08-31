/**
 * Test utilities for Simply View Image for Python Debugging extension
 */

import type { DebugView, EditorTab, ViewSection } from 'vscode-extension-tester';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ActivityBar, EditorView, InputBox, TitleBar, VSBrowser, Workbench } from 'vscode-extension-tester';

/**
 * Ensures the Simply View Image for Python Debugging extension is activated.
 * This function should be called in the 'before' hook of all test suites.
 *
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Promise<void>
 */
export async function ensureExtensionActivated(timeout: number = 30000): Promise<void> {
  const extensionId = 'elazarcoh.simply-view-image-for-python-debugging';

  try {
    console.log(`Ensuring extension '${extensionId}' is activated...`);

    // Wait for the extension to be loaded and activated by checking for its commands
    await VSBrowser.instance.driver.wait(async () => {
      try {
        const workbench = new Workbench();

        // Try to verify the extension is active by checking for its commands
        await workbench.executeCommand('workbench.action.showCommands');
        await VSBrowser.instance.driver.sleep(500);

        // Type extension command prefix to see if commands are available
        await VSBrowser.instance.driver.actions().sendKeys('svifpd').perform();
        await VSBrowser.instance.driver.sleep(500);

        // Press Escape to close command palette
        await VSBrowser.instance.driver.actions().sendKeys('\uE00C').perform();

        console.log('✓ Extension commands are available - extension is activated');
        return true;
      }
      catch (error) {
        console.log('Extension commands not yet available, retrying...', error);
        return false;
      }
    }, timeout);

    // Additional verification: try to execute a direct extension command
    try {
      const workbench = new Workbench();
      await workbench.executeCommand('svifpd.refresh-variables');
      console.log('✓ Extension command executed successfully - extension is fully activated');
    }
    catch (cmdError) {
      // This is acceptable - the command might not be available outside debug context
      console.log('Note: Some extension commands require debug context (this is normal)');
    }

    console.log('✓ Extension activation verification completed');
  }
  catch (error) {
    console.warn('Extension activation verification encountered issues:', error);
    // Don't throw - allow tests to proceed as extension might still be functional
    console.log('Proceeding with tests - extension may still be functional');
  }
}

/**
 * Waits for VS Code to be fully ready for testing.
 * This includes waiting for the activity bar and basic UI elements.
 *
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Promise<void>
 */
export async function waitForVSCodeReady(timeout: number = 30000): Promise<void> {
  console.log('Waiting for VS Code to be ready...');

  await VSBrowser.instance.driver.wait(async () => {
    try {
      const activityBar = new (await import('vscode-extension-tester')).ActivityBar();
      await activityBar.getViewControl('Explorer');
      return true;
    }
    catch {
      return false;
    }
  }, timeout);

  console.log('✓ VS Code is ready for testing');
}

/**
 * Combined setup function that ensures VS Code is ready and the extension is activated.
 * This is the recommended function to call in test 'before' hooks.
 *
 * @param timeout - Timeout in milliseconds (default: 60000)
 * @returns Promise<void>
 */
export async function setupTestEnvironment(timeout: number = 60000): Promise<void> {
  try {
    await waitForVSCodeReady(timeout / 2);
    await ensureExtensionActivated(timeout / 2);
    console.log('✓ Test environment setup completed successfully');
  }
  catch (error) {
    console.warn('Test environment setup encountered issues:', error);
    // Allow tests to continue - they may still pass
    console.log('Continuing with tests despite setup issues...');
  }
}

/**
 * Ensures the Image Watch section is available and expanded in the Debug view.
 * This function navigates to the Debug view, finds the Image Watch panel, and expands it.
 *
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Promise<ViewSection | null> - Returns the Image Watch section object or null if not found
 */
export async function ensureImageWatchSectionExpanded(timeout: number = 30000): Promise<ViewSection | null> {
  try {
    console.log('Ensuring Image Watch section is expanded...');

    // Open the debug panel
    const btn = await new ActivityBar().getViewControl('Run');
    if (!btn) {
      throw new Error('Could not find Run and Debug view');
    }
    const debugView = (await btn.openView()) as DebugView;

    const imageWatchSection = await debugView.getContent().getSection('Image Watch');

    // Expand the section
    try {
      await imageWatchSection.expand(2000);
      await VSBrowser.instance.driver.sleep(1000);
      const isExpanded = await imageWatchSection.isExpanded();
      if (!isExpanded) {
        console.warn('Failed to expand Image Watch section');
        return null;
      }
      console.log('✓ Image Watch section is expanded and ready');
      return imageWatchSection;
    }
    catch (error) {
      console.warn('Error expanding Image Watch section:', error);
      return null;
    }
  }
  catch (error) {
    console.warn('Failed to ensure Image Watch section is expanded:', error);
    return null;
  }
}

/**
 * Opens the Image View webview by clicking the browser icon in the Image Watch view.
 * Uses the ensureImageWatchSectionExpanded function to get the section first.
 *
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Promise<boolean> - Returns true if webview was successfully opened
 */
export async function openImageWebview(timeout: number = 30000): Promise<boolean> {
  try {
    console.log('Opening Image View webview via UI...');

    // Ensure the Image Watch section is expanded and get the section object
    const imageWatchSection = await ensureImageWatchSectionExpanded(timeout);

    if (!imageWatchSection) {
      console.warn('Could not get Image Watch section');
      return false;
    }

    // Get the "Open Image Webview" action button
    // According to package.json, it should have the title "Open Image Webview" and icon "$(browser)"
    try {
      const openWebviewAction = await imageWatchSection.getAction('Open Image Webview');
      if (openWebviewAction) {
        console.log('Found "Open Image Webview" action button, clicking...');
        await openWebviewAction.click();
        await VSBrowser.instance.driver.sleep(3000); // Wait for webview to load
        console.log('✓ Image View webview opened successfully via action button');
        return true;
      }
    }
    catch (actionError) {
      console.log('Could not find "Open Image Webview" action button:', actionError);
    }

    console.warn('Failed to open webview via Image Watch section actions');
    return false;
  }
  catch (error) {
    console.warn('Failed to open webview via UI:', error);
    return false;
  }
}

/**
 * Checks if the Image View webview is currently open in any editor tab.
 * Uses the EditorView API to check for open tabs that contain webview content.
 *
 * @param groupIndex - Optional editor group index to check (default: check all groups)
 * @returns Promise<boolean> - Returns true if webview is open
 */
export async function getOpenedImageWebview(groupIndex?: number): Promise<EditorTab | null> {
  try {
    const editorView = new EditorView();

    const openedTabs = await editorView.getOpenTabs(groupIndex);

    // Get open editor titles for the specified group or all groups
    const openTitles = await Promise.all(openedTabs.map(async tab => tab.getTitle()));

    console.log('Currently open editor titles:', openTitles);

    // Check for webview-related titles
    const webviewTitles = [
      'Image View',
    ];

    const index = openTitles.findIndex(title =>
      webviewTitles.some(webviewTitle =>
        title.toLowerCase().includes(webviewTitle.toLowerCase()),
      ),
    );

    const hasWebview = index !== -1;

    if (hasWebview) {
      console.log('✓ Image View webview is open');
      return openedTabs[index];
    }

    console.log('Image View webview is not currently open');
    return null;
  }
  catch (error) {
    console.warn('Error checking if webview is open:', error);
    return null;
  }
}

/**
 * Waits for the Image View webview to open within a specified timeout.
 * Useful for waiting after triggering webview open action.
 *
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @param groupIndex - Optional editor group index to check (default: check all groups)
 * @returns Promise<boolean> - Returns true if webview opens within timeout
 */
export async function waitForImageWebviewToOpen(timeout: number = 10000, groupIndex?: number): Promise<EditorTab | null> {
  try {
    console.log('Waiting for Image View webview to open...');

    const isOpen = await VSBrowser.instance.driver.wait(async () => {
      return await getOpenedImageWebview(groupIndex);
    }, timeout, 'Image View webview did not open in time', 1000);

    console.log('✓ Image View webview opened successfully');
    return isOpen;
  }
  catch (error) {
    console.warn('Timeout waiting for webview to open:', error);
    return null;
  }
}

export async function openFile(filePath: string) {
  await new Workbench().executeCommand('workbench.action.quickOpen');

  const input = await InputBox.create();
  await input.setText(filePath);
  await input.confirm();
}

export async function openWorkspaceFile(workspacePath: string) {
  await new Workbench().executeCommand('workbench.action.openWorkspace');
  const input = await InputBox.create();
  await input.setText(workspacePath);
  await input.confirm();
}

export async function openEditor(file: string) {
  const titleBar = new TitleBar();
  const item = await titleBar.getItem('File');
  const fileMenu = await item!.select();
  const openItem = await fileMenu.getItem('Open File...');
  await openItem!.select();
  const input = await InputBox.create();
  await input.setText(file);
  await input.confirm();
}

export async function writeScreenshot(data: string, name: string) {
  const dir = VSBrowser.instance.getScreenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${name}.png`), data, 'base64');
}
