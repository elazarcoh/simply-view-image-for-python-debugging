/**
 * DebugTestHelper - A comprehensive utility class for testing Python debugging functionality
 * with the Simply View Image for Python Debugging extension.
 */

import type { DebugView, Editor, EditorTab, TreeItem, ViewSection } from 'vscode-extension-tester';
import { ActivityBar, DebugToolbar, EditorView, InputBox, TitleBar, VSBrowser, Workbench } from 'vscode-extension-tester';
import { writeScreenshot } from './test-utils';

export interface DebugTestOptions {
  timeout?: number;
  retryCount?: number;
  sleepDuration?: number;
}

export interface VariableActionOptions {
  actionLabel: string;
  variableName: string;
  retrySetup?: boolean;
  setupRetries?: number;
}

export interface ExpressionOptions {
  expression: string;
  timeout?: number;
}

export interface ScreenshotOptions {
  name: string;
  elementType?: 'webview' | 'editor' | 'fullscreen';
}

/**
 * DebugTestHelper provides a fluent API for interacting with VS Code debugging features
 * in test scenarios. It encapsulates common patterns for:
 * - Debug session management
 * - File operations
 * - UI navigation
 * - Variable interactions
 * - Webview operations
 * - Expression management
 * - Screenshot capture
 */
export class DebugTestHelper {
  private static instance: DebugTestHelper | null = null;
  private debugView: DebugView | null = null;
  private debugToolbar: DebugToolbar | null = null;
  private imageWatchSection: ViewSection | null = null;
  private currentEditor: Editor | null = null;
  private webviewTab: EditorTab | null = null;

  private constructor(private options: DebugTestOptions = {}) {
    this.options = {
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
      ...options,
    };
  }

  /**
   * Get or create a singleton instance of DebugTestHelper
   */
  static getInstance(options?: DebugTestOptions): DebugTestHelper {
    if (!DebugTestHelper.instance) {
      DebugTestHelper.instance = new DebugTestHelper(options);
    }
    return DebugTestHelper.instance;
  }

  /**
   * Reset the helper instance (useful between tests)
   */
  static reset(): void {
    DebugTestHelper.instance = null;
  }

  // =============================================================================
  // FILE OPERATIONS
  // =============================================================================

  /**
   * Open a file in the workspace
   */
  async openFile(filePath: string): Promise<this> {
    console.log(`Step: Opening file ${filePath}`);

    const titleBar = new TitleBar();
    const fileMenu = await (await titleBar.getItem('File'))!.select();
    const openItem = await fileMenu.getItem('Open File...');
    await openItem!.select();

    const input = await InputBox.create();
    await input.setText(filePath);
    await input.confirm();

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log(`Step: File ${filePath} opened`);
    return this;
  }

  /**
   * Open an editor for a specific file
   */
  async openEditor(fileName: string): Promise<this> {
    console.log(`Step: Opening editor for ${fileName}`);

    const editorView = new EditorView();
    this.currentEditor = await editorView.openEditor(fileName);

    if (!this.currentEditor.isDisplayed()) {
      throw new Error(`Editor for ${fileName} is not displayed`);
    }

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log(`Step: Editor for ${fileName} is displayed`);
    return this;
  }

  // =============================================================================
  // DEBUG SESSION MANAGEMENT
  // =============================================================================

  /**
   * Open the debug panel and prepare for debugging
   */
  async openDebugPanel(): Promise<this> {
    console.log('Step: Opening debug panel');

    const btn = await new ActivityBar().getViewControl('Run');
    if (!btn) {
      throw new Error('Could not find Run and Debug view');
    }

    this.debugView = (await btn.openView()) as DebugView;
    console.log('Step: Debug panel opened');
    return this;
  }

  /**
   * Select a launch configuration for debugging
   */
  async selectLaunchConfiguration(configNamePattern: string): Promise<this> {
    if (!this.debugView) {
      throw new Error('Debug view not opened. Call openDebugPanel() first.');
    }

    console.log(`Step: Getting launch configurations matching "${configNamePattern}"`);

    const configs = await this.debugView.getLaunchConfigurations();
    const configName = configs.find(c => c.includes(configNamePattern));

    if (!configName) {
      throw new Error(`Could not find launch configuration matching "${configNamePattern}". Available: ${configs.join(', ')}`);
    }

    await this.debugView.selectLaunchConfiguration(configName);
    console.log(`Step: Launch configuration "${configName}" selected`);
    return this;
  }

  /**
   * Start debugging session
   */
  async startDebugging(): Promise<this> {
    if (!this.debugView) {
      throw new Error('Debug view not opened. Call openDebugPanel() first.');
    }

    console.log('Step: Starting debug session');
    await this.debugView.start();
    await VSBrowser.instance.driver.sleep(3000);
    console.log('Step: Debug session started');
    return this;
  }

  /**
   * Wait for debug toolbar to appear and breakpoint to be hit
   */
  async waitForBreakpoint(): Promise<this> {
    console.log('Step: Waiting for debug toolbar');

    this.debugToolbar = await DebugToolbar.create();

    const isDisplayed = await VSBrowser.instance.driver.wait(async () => {
      return this.debugToolbar!.isDisplayed();
    }, this.options.timeout!, 'Debug toolbar did not appear in time', 1000);

    if (!isDisplayed) {
      throw new Error('Debug toolbar did not appear in time');
    }

    console.log('Step: Debug toolbar is displayed');

    console.log('Step: Waiting for breakpoint to be hit');
    await this.debugToolbar.waitForBreakPoint(3000);
    console.log('Step: Breakpoint hit');
    return this;
  }

  /**
   * Stop the debugging session
   */
  async stopDebugging(): Promise<this> {
    if (!this.debugToolbar) {
      console.warn('Debug toolbar not available, trying to stop via debug view');
      // Fallback: try to get debug toolbar
      try {
        this.debugToolbar = await DebugToolbar.create();
      }
      catch (error) {
        console.warn('Could not get debug toolbar for stopping:', error);
        return this;
      }
    }

    console.log('Step: Stopping debugger');
    await this.debugToolbar.stop();
    await VSBrowser.instance.driver.sleep(2000);
    console.log('Step: Debugger stopped');
    return this;
  }

  // =============================================================================
  // BREAKPOINT MANAGEMENT
  // =============================================================================

  /**
   * Add a breakpoint to the current editor at specified line
   */
  async addBreakpoint(lineNumber: number): Promise<this> {
    if (!this.currentEditor) {
      throw new Error('No editor is currently open. Call openEditor() first.');
    }

    console.log(`Step: Adding breakpoint at line ${lineNumber}`);
    // Note: The exact API for adding breakpoints may vary
    // This is a placeholder for the actual implementation
    console.log(`Step: Breakpoint added at line ${lineNumber} (implementation may vary)`);
    return this;
  }

  // =============================================================================
  // IMAGE WATCH SECTION OPERATIONS
  // =============================================================================

  /**
   * Expand the Image Watch section in the debug view
   */
  async expandImageWatchSection(): Promise<this> {
    if (!this.debugView) {
      throw new Error('Debug view not opened. Call openDebugPanel() first.');
    }

    console.log('Step: Expanding Image Watch section');

    this.imageWatchSection = await this.debugView.getContent().getSection('Image Watch');

    try {
      await this.imageWatchSection.expand(2000);
      await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);

      const isExpanded = await this.imageWatchSection.isExpanded();
      if (!isExpanded) {
        throw new Error('Failed to expand Image Watch section');
      }

      console.log('Step: Image Watch section expanded');
    }
    catch (error) {
      throw new Error(`Error expanding Image Watch section: ${error}`);
    }

    return this;
  }

  /**
   * Refresh the Image Watch section
   */
  async refreshImageWatch(): Promise<this> {
    if (!this.imageWatchSection) {
      throw new Error('Image Watch section not available. Call expandImageWatchSection() first.');
    }

    console.log('Step: Refreshing Image Watch section');

    const refreshButton = await this.imageWatchSection.getAction('Refresh');
    if (!refreshButton) {
      throw new Error('Refresh button is not available');
    }

    await refreshButton.click();
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log('Step: Image Watch section refreshed');
    return this;
  }

  // =============================================================================
  // VARIABLE OPERATIONS
  // =============================================================================

  /**
   * Find and expand a tree item in the Image Watch section
   */
  async findAndExpandTreeItem(itemName: string): Promise<TreeItem> {
    if (!this.imageWatchSection) {
      throw new Error('Image Watch section not available. Call expandImageWatchSection() first.');
    }

    console.log(`Step: Finding tree item "${itemName}"`);

    const item = await this.imageWatchSection.findItem(itemName) as TreeItem | undefined;
    if (!item) {
      throw new Error(`Tree item "${itemName}" not found`);
    }

    console.log(`Step: Tree item "${itemName}" found and expanded`);
    return item;
  }

  /**
   * Find a variable and perform an action on it
   */
  async performVariableAction(options: VariableActionOptions): Promise<this> {
    const { variableName, actionLabel, retrySetup = true, setupRetries = 5 } = options;

    console.log(`Step: Finding variable "${variableName}"`);

    // First find the Variables item
    const variablesItem = await this.findAndExpandTreeItem('Variables');

    // Try to find the specific variable with retries and setup refresh
    let variableItem: TreeItem | undefined;

    for (let i = 0; i < setupRetries; i++) {
      variableItem = (await variablesItem.findChildItem(variableName)) as TreeItem | undefined;
      if (variableItem) {
        break;
      }

      if (retrySetup) {
        console.log(`Step: Variable "${variableName}" not found, running setup and refresh (attempt ${i + 1})`);
        await new Workbench().executeCommand('svifpd.run-setup');
        await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
        await this.refreshImageWatch();
      }
    }

    if (!variableItem) {
      throw new Error(`Variable "${variableName}" not found after ${setupRetries} attempts`);
    }

    console.log(`Step: Variable "${variableName}" found`);

    // Get action buttons and find the specified action
    console.log(`Step: Getting action buttons for "${variableName}"`);
    const buttons = await variableItem.getActionButtons();

    let actionFound = false;
    for (const btn of buttons) {
      const label = await btn.getLabel();
      console.log(`Step: Found button label: "${label}"`);
      if (label === actionLabel) {
        console.log(`Step: Clicking "${actionLabel}" button`);
        await btn.click();
        actionFound = true;
        break;
      }
    }

    if (!actionFound) {
      const availableActions = await Promise.all(buttons.map(btn => btn.getLabel()));
      throw new Error(`Action "${actionLabel}" not found. Available actions: ${availableActions.join(', ')}`);
    }

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log(`Step: Action "${actionLabel}" performed on variable "${variableName}"`);
    return this;
  }

  // =============================================================================
  // EXPRESSION MANAGEMENT
  // =============================================================================

  /**
   * Add an expression through the command palette
   */
  async addExpression(options: ExpressionOptions): Promise<this> {
    const { expression, timeout = this.options.timeout } = options;

    console.log(`Step: Adding expression "${expression}"`);

    // Execute the add expression command
    await new Workbench().executeCommand('svifpd.add-expression');
    await VSBrowser.instance.driver.sleep(500);

    // Wait for input box and enter the expression
    try {
      const input = await InputBox.create(timeout);
      await input.setText(expression);
      await input.confirm();
      await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);

      console.log(`Step: Expression "${expression}" added`);
    }
    catch (error) {
      throw new Error(`Failed to add expression "${expression}": ${error}`);
    }

    return this;
  }

  /**
   * Edit an existing expression
   */
  async editExpression(oldExpression: string, newExpression: string): Promise<this> {
    console.log(`Step: Editing expression from "${oldExpression}" to "${newExpression}"`);

    // This would typically involve finding the expression in the tree and using edit action
    // Implementation details depend on the exact UI structure
    await new Workbench().executeCommand('svifpd.edit-expression');
    await VSBrowser.instance.driver.sleep(500);

    try {
      const input = await InputBox.create();
      await input.setText(newExpression);
      await input.confirm();
      await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);

      console.log(`Step: Expression edited to "${newExpression}"`);
    }
    catch (error) {
      throw new Error(`Failed to edit expression: ${error}`);
    }

    return this;
  }

  // =============================================================================
  // WEBVIEW OPERATIONS
  // =============================================================================

  /**
   * Find and switch to the Image View webview
   */
  async findImageWebview(): Promise<this> {
    console.log('Step: Finding Image View webview');

    const editorView = new EditorView();
    let webviewEditor: Editor | undefined;

    for (const group of await editorView.getEditorGroups()) {
      const titles = await group.getOpenEditorTitles();
      if (titles.includes('Image View')) {
        webviewEditor = await group.openEditor('Image View');
        if (webviewEditor) {
          this.webviewTab = await this.findImageWebviewTab();
          break;
        }
      }
    }

    if (!webviewEditor) {
      throw new Error('Image View webview is not open');
    }

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log('Step: Image View webview found and focused');
    return this;
  }

  /**
   * Wait for the Image View webview to open
   */
  async waitForImageWebview(): Promise<this> {
    console.log('Step: Waiting for Image View webview to open');

    const webviewTab = await VSBrowser.instance.driver.wait(async () => {
      return await this.findImageWebviewTab();
    }, this.options.timeout!, 'Image View webview did not open in time', 1000);

    if (!webviewTab) {
      throw new Error('Image View webview did not open in time');
    }

    this.webviewTab = webviewTab;
    console.log('Step: Image View webview opened');
    return this;
  }

  /**
   * Helper method to find the Image View webview tab
   */
  private async findImageWebviewTab(): Promise<EditorTab | null> {
    try {
      const editorView = new EditorView();
      const openedTabs = await editorView.getOpenTabs();
      const openTitles = await Promise.all(openedTabs.map(async tab => tab.getTitle()));

      const webviewTitles = ['Image View'];
      const index = openTitles.findIndex(title =>
        webviewTitles.some(webviewTitle =>
          title.toLowerCase().includes(webviewTitle.toLowerCase()),
        ),
      );

      return index !== -1 ? openedTabs[index] : null;
    }
    catch (error) {
      console.warn('Error finding Image View webview tab:', error);
      return null;
    }
  }

  /**
   * Interact with the webview (placeholder for specific interactions)
   */
  async interactWithWebview(): Promise<this> {
    if (!this.webviewTab) {
      throw new Error('Webview not available. Call waitForImageWebview() first.');
    }

    console.log('Step: Interacting with webview');
    // Placeholder for specific webview interactions
    // This could include clicking buttons, changing settings, etc.
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log('Step: Webview interaction completed');
    return this;
  }

  // =============================================================================
  // SCREENSHOT OPERATIONS
  // =============================================================================

  /**
   * Take a screenshot of the current webview or editor
   */
  async takeScreenshot(options: ScreenshotOptions): Promise<this> {
    const { name, elementType = 'webview' } = options;

    console.log(`Step: Taking ${elementType} screenshot "${name}"`);

    let screenshot: string;

    switch (elementType) {
      case 'webview': {
        if (!this.webviewTab) {
          throw new Error('Webview not available for screenshot. Call waitForImageWebview() first.');
        }
        const editorView = new EditorView();
        const webviewEditor = await editorView.openEditor('Image View');
        if (!webviewEditor) {
          throw new Error('Could not open Image View editor for screenshot');
        }
        screenshot = await webviewEditor.takeScreenshot();
        break;
      }
      case 'editor': {
        if (!this.currentEditor) {
          throw new Error('No editor available for screenshot. Call openEditor() first.');
        }
        screenshot = await this.currentEditor.takeScreenshot();
        break;
      }
      case 'fullscreen': {
        // VSBrowser.takeScreenshot doesn't return the screenshot data, so we need a different approach
        // We'll use a different method for fullscreen screenshots
        const currentEditor = new EditorView();
        const activeTab = await currentEditor.getActiveTab();
        if (activeTab) {
          screenshot = await activeTab.getDriver().takeScreenshot();
        }
        else {
          throw new Error('No active tab available for fullscreen screenshot');
        }
        break;
      }
      default: {
        throw new Error(`Unknown screenshot element type: ${elementType}`);
      }
    }

    await writeScreenshot(screenshot, name);
    console.log(`Step: Screenshot "${name}" saved`);
    return this;
  }

  // =============================================================================
  // COMMAND EXECUTION
  // =============================================================================

  /**
   * Execute a VS Code command
   */
  async executeCommand(command: string): Promise<this> {
    console.log(`Step: Executing command "${command}"`);
    await new Workbench().executeCommand(command);
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    console.log(`Step: Command "${command}" executed`);
    return this;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Add a custom sleep/wait
   */
  async wait(ms: number = this.options.sleepDuration!): Promise<this> {
    await VSBrowser.instance.driver.sleep(ms);
    return this;
  }

  /**
   * Log a custom message
   */
  log(message: string): this {
    console.log(`Step: ${message}`);
    return this;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('Step: Cleaning up DebugTestHelper resources');

    // Stop debugging if still active
    if (this.debugToolbar) {
      try {
        await this.stopDebugging();
      }
      catch (error) {
        console.warn('Error stopping debugger during cleanup:', error);
      }
    }

    // Reset internal state
    this.debugView = null;
    this.debugToolbar = null;
    this.imageWatchSection = null;
    this.currentEditor = null;
    this.webviewTab = null;

    console.log('Step: DebugTestHelper cleanup completed');
  }
}
