/**
 * DebugTestHelper - A comprehensive utility class for testing Python debugging functionality
 * with the Simply View Image for Python Debugging extension.
 */

import type { DebugView, Editor, EditorTab, TreeItem, ViewSection, WebElement } from 'vscode-extension-tester';
import { basename } from 'node:path/win32';
import { ActivityBar, DebugToolbar, EditorView, InputBox, TitleBar, VSBrowser, Workbench } from 'vscode-extension-tester';
import { writeScreenshot } from './test-utils';

export interface DebugTestOptions {
  timeout?: number;
  retryCount?: number;
  sleepDuration?: number;
  autoEnsureViews?: boolean; // Automatically ensure views are open/valid
}

export interface VariableActionOptions {
  actionLabel: string;
  variableName: string;
  retrySetup?: boolean;
  setupRetries?: number;
  type: 'variable' | 'expression';
}

export interface ExpressionOptions {
  expression: string;
  timeout?: number;
}

export interface SetupEditorOptions {
  fileName: string;
  debugConfig?: string;
  openFile?: boolean;
}

export interface ScreenshotOptions {
  name: string;
  element: WebElement | 'screen';
  testPrefix?: string;
}

export interface WebviewOptions {
  autoOpen?: boolean;
  timeout?: number;
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
  private currentTestName: string = 'unknown-test';

  private constructor(private options: DebugTestOptions = {}) {
    this.options = {
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
      autoEnsureViews: true,
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

  /**
   * Set the current test name for screenshot prefixes
   */
  setCurrentTest(testName: string): this {
    this.currentTestName = testName;
    return this;
  }

  // =============================================================================
  // FILE OPERATIONS
  // =============================================================================

  /**
   * Open a file in the workspace
   */
  async openFile(filePath: string): Promise<this> {
    const checkFileOpen = async () => {
      const editorView = new EditorView();
      const titles = await editorView.getOpenEditorTitles();
      return titles.includes(basename(filePath));
    };

    DebugTestHelper.logger.step(`Opening file ${filePath}`);

    const titleBar = new TitleBar();
    const item = await titleBar.getItem('File');
    const fileMenu = await item!.select();
    const openItem = await fileMenu.getItem('Open File...');
    await openItem!.select();

    const input = await InputBox.create();
    await input.setText(filePath);

    // Try confirming the input up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      await input.confirm();
      const isOpened = await checkFileOpen();
      if (isOpened) {
        DebugTestHelper.logger.step(`File ${filePath} is opened in an editor`);
        return this;
      }
      await this.sleep(500);
    }

    await this.takeScreenshot({ name: 'failed-to-open-file', element: 'screen' });
    throw new Error(`Failed to open file ${filePath} in an editor`);
  }

  /**
   * Open an editor for a specific file
   */
  async openEditor(fileName: string): Promise<this> {
    DebugTestHelper.logger.step(`Opening editor for ${fileName}`);

    const editorView = new EditorView();
    this.currentEditor = await editorView.openEditor(fileName);

    if (!this.currentEditor.isDisplayed()) {
      throw new Error(`Editor for ${fileName} is not displayed`);
    }

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    DebugTestHelper.logger.step(`Editor for ${fileName} is displayed`);
    return this;
  }

  // =============================================================================
  // DEBUG SESSION MANAGEMENT
  // =============================================================================

  /**
   * Open the debug panel and prepare for debugging
   */
  async openDebugPanel(): Promise<this> {
    DebugTestHelper.logger.step('Opening debug panel');

    const btn = await new ActivityBar().getViewControl('Run');
    if (!btn) {
      throw new Error('Could not find Run and Debug view');
    }

    this.debugView = (await btn.openView()) as DebugView;
    DebugTestHelper.logger.step('Debug panel opened');
    return this;
  }

  /**
   * Select a launch configuration for debugging
   */
  async selectLaunchConfiguration(configNamePattern: string): Promise<this> {
    if (this.options.autoEnsureViews) {
      await this.ensureDebugViewOpen();
    }
    else if (!this.debugView) {
      throw new Error('Debug view not opened. Call openDebugPanel() first.');
    }

    DebugTestHelper.logger.step(`Getting launch configurations matching "${configNamePattern}"`);

    const configs = await this.debugView!.getLaunchConfigurations();
    const configName = configs.find(c => c.includes(configNamePattern));

    if (!configName) {
      throw new Error(`Could not find launch configuration matching "${configNamePattern}". Available: ${configs.join(', ')}`);
    }

    await this.debugView!.selectLaunchConfiguration(configName);
    DebugTestHelper.logger.step(`Launch configuration "${configName}" selected`);
    return this;
  }

  /**
   * Start debugging session
   */
  async startDebugging(): Promise<this> {
    if (this.options.autoEnsureViews) {
      await this.ensureDebugViewOpen();
    }
    else if (!this.debugView) {
      throw new Error('Debug view not opened. Call openDebugPanel() first.');
    }

    DebugTestHelper.logger.step('Starting debug session');
    await this.debugView!.start();
    await VSBrowser.instance.driver.sleep(3000);
    DebugTestHelper.logger.step('Debug session started');
    return this;
  }

  /**
   * Wait for debug toolbar to appear and breakpoint to be hit
   */
  async waitForBreakpoint(): Promise<this> {
    DebugTestHelper.logger.step('Waiting for debug toolbar');

    this.debugToolbar = await DebugToolbar.create();

    const isDisplayed = await VSBrowser.instance.driver.wait(async () => {
      return this.debugToolbar!.isDisplayed();
    }, this.options.timeout!, 'Debug toolbar did not appear in time', 1000);

    if (!isDisplayed) {
      DebugTestHelper.logger.error('Debug toolbar did not appear in time. Taking screenshot...');
      await this.takeScreenshot({
        name: 'debug-toolbar-timeout',
        element: 'screen',
      });
      throw new Error('Debug toolbar did not appear in time');
    }

    DebugTestHelper.logger.success('Debug toolbar is displayed');
    DebugTestHelper.logger.step('Waiting for breakpoint to be hit');

    try {
      await this.debugToolbar.waitForBreakPoint(3000);
      DebugTestHelper.logger.success('Breakpoint hit');
      return this;
    }
    catch (breakpointError) {
      DebugTestHelper.logger.error('Timeout waiting for breakpoint. Taking screenshot...');
      await this.takeScreenshot({
        name: 'breakpoint-timeout',
        element: 'screen',
      });
      throw new Error(`Breakpoint was not hit in time: ${breakpointError}`);
    }
  }

  /**
   * Stop the debugging session
   */
  async stopDebugging(): Promise<this> {
    if (!this.debugToolbar) {
      DebugTestHelper.logger.warn('Debug toolbar not available, trying to stop via debug view');
      // Fallback: try to get debug toolbar
      try {
        this.debugToolbar = await DebugToolbar.create();
      }
      catch (error) {
        DebugTestHelper.logger.warn(`Could not get debug toolbar for stopping: ${error}`);
        return this;
      }
    }

    DebugTestHelper.logger.step('Stopping debugger');
    await this.debugToolbar.stop();
    await VSBrowser.instance.driver.sleep(2000);
    DebugTestHelper.logger.step('Debugger stopped');
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

    DebugTestHelper.logger.step(`Adding breakpoint at line ${lineNumber}`);

    // Use the goto line command to navigate to the specific line
    await new Workbench().executeCommand('workbench.action.gotoLine');
    await VSBrowser.instance.driver.sleep(500);

    // Enter the line number in the input box
    const input = await InputBox.create(this.options.timeout);
    await input.setText(lineNumber.toString());
    await input.confirm();
    await VSBrowser.instance.driver.sleep(500);

    // Toggle breakpoint using command
    await new Workbench().executeCommand('editor.debug.action.toggleBreakpoint');
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);

    DebugTestHelper.logger.step(`Breakpoint added at line ${lineNumber}`);
    return this;
  }

  // =============================================================================
  // IMAGE WATCH SECTION OPERATIONS
  // =============================================================================

  /**
   * Expand the Image Watch section in the debug view
   */
  async expandImageWatchSection(): Promise<this> {
    if (this.options.autoEnsureViews) {
      await this.ensureDebugViewOpen();
    }
    else if (!this.debugView) {
      throw new Error('Debug view not opened. Call openDebugPanel() first.');
    }

    DebugTestHelper.logger.step('Expanding Image Watch section');

    const imageWatchSection = await this.getImageWatchSection();
    await this.expandSection(imageWatchSection);
    await this.verifyExpansion(imageWatchSection);

    this.imageWatchSection = imageWatchSection;
    DebugTestHelper.logger.success('Image Watch section expanded');
    return this;
  }

  private async getImageWatchSection(): Promise<ViewSection> {
    const imageWatchSection = await this.debugView!.getContent().getSection('Image Watch').catch(async (getSectionError) => {
      DebugTestHelper.logger.error(`Error getting Image Watch section: ${getSectionError}`);
      await this.takeScreenshot({
        name: 'image-watch-section-get-error',
        element: 'screen',
      });

      const sectionTitles = await this.getAvailableSectionTitles();
      DebugTestHelper.logger.info(`Available debug sections when Image Watch section not found: [${sectionTitles.join(', ')}]`);
      throw new Error(`Image Watch section not found. Available sections: [${sectionTitles.join(', ')}]. Original error: ${getSectionError}`);
    });

    return imageWatchSection;
  }

  private async expandSection(section: ViewSection): Promise<void> {
    await section.expand(2000).catch(async (expandError) => {
      DebugTestHelper.logger.error(`Error expanding Image Watch section: ${expandError}`);
      await this.takeScreenshot({
        name: 'image-watch-section-expand-error',
        element: 'screen',
      });
      throw new Error(`Error expanding Image Watch section: ${expandError}`);
    });

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
  }

  private async verifyExpansion(section: ViewSection): Promise<void> {
    const isExpanded = await section.isExpanded();
    if (isExpanded)
      return;

    DebugTestHelper.logger.error('Failed to expand Image Watch section. Taking screenshot...');
    await this.takeScreenshot({
      name: 'image-watch-section-expand-failed',
      element: 'screen',
    });

    const sectionTitles = await this.getAvailableSectionTitles();
    DebugTestHelper.logger.info(`Available debug sections: [${sectionTitles.join(', ')}]`);
    throw new Error(`Failed to expand Image Watch section. Available sections: [${sectionTitles.join(', ')}]`);
  }

  private async getAvailableSectionTitles(): Promise<string[]> {
    const allSections = await this.debugView!.getContent().getSections();
    return Promise.all(
      allSections.map(async (section) => {
        try {
          return await section.getTitle();
        }
        catch (e) {
          return '[Title unavailable]';
        }
      }),
    );
  }

  /**
   * Refresh the Image Watch section
   */
  async refreshImageWatch(): Promise<this> {
    if (this.options.autoEnsureViews) {
      await this.ensureImageWatchSectionExpanded();
    }
    else if (!this.imageWatchSection) {
      throw new Error('Image Watch section not available. Call expandImageWatchSection() first.');
    }

    DebugTestHelper.logger.step('Refreshing Image Watch section');

    const refreshButton = await this.imageWatchSection!.getAction('Refresh');
    if (!refreshButton) {
      throw new Error('Refresh button is not available');
    }

    await refreshButton.click();
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    DebugTestHelper.logger.step('Image Watch section refreshed');
    return this;
  }

  /**
   * Wait for the Image Watch section to have visible items populated.
   * This is crucial for headless/CI environments where UI may be slower to update.
   * @param options - Configuration for waiting behavior
   * @param options.timeout - Maximum time to wait in ms (default: 15000)
   * @param options.minItems - Minimum number of items to wait for (default: 1)
   */
  async waitForImageWatchItems(options: { timeout?: number; minItems?: number } = {}): Promise<this> {
    const { timeout = 15000, minItems = 1 } = options;

    if (this.options.autoEnsureViews) {
      await this.ensureImageWatchSectionExpanded();
    }
    else if (!this.imageWatchSection) {
      throw new Error('Image Watch section not available. Call expandImageWatchSection() first.');
    }

    DebugTestHelper.logger.step(`Waiting for Image Watch section to have at least ${minItems} item(s)...`);

    const startTime = Date.now();
    let lastItemCount = 0;

    const hasItems = await VSBrowser.instance.driver.wait(async () => {
      const allItems = await this.imageWatchSection!.getVisibleItems();
      lastItemCount = allItems.length;

      if (lastItemCount >= minItems) {
        return true;
      }

      // Log progress periodically
      const elapsed = Date.now() - startTime;
      if (elapsed > 0 && elapsed % DebugTestHelper.PROGRESS_LOG_INTERVAL_MS < DebugTestHelper.POLL_INTERVAL_MS) {
        DebugTestHelper.logger.info(`Still waiting for items... current count: ${lastItemCount}, elapsed: ${Math.floor(elapsed / 1000)}s`);
      }

      return false;
    }, timeout, `Image Watch section did not populate with ${minItems} items within ${timeout}ms`, DebugTestHelper.POLL_INTERVAL_MS);

    if (hasItems) {
      DebugTestHelper.logger.success(`Image Watch section has ${lastItemCount} item(s)`);
    }

    return this;
  }

  // =============================================================================
  // VARIABLE OPERATIONS
  // =============================================================================

  /**
   * Find and expand a tree item in the Image Watch section
   */
  async findAndExpandTreeItem(itemName: string): Promise<TreeItem> {
    if (this.options.autoEnsureViews) {
      await this.ensureImageWatchSectionExpanded();
    }
    else if (!this.imageWatchSection) {
      throw new Error('Image Watch section not available. Call expandImageWatchSection() first.');
    }

    DebugTestHelper.logger.step(`Finding tree item "${itemName}"`);

    // Wait for items to be populated before searching (improves robustness in CI)
    await this.waitForItemsWithRetry();

    DebugTestHelper.logger.debug('Debugging tree structure in Image Watch section...');
    const itemInfo = await this.getTreeItemDebugInfo();
    DebugTestHelper.logger.info(`Found ${itemInfo.length} visible items in Image Watch section`);
    DebugTestHelper.logger.info(`Available items in Image Watch section:\n${itemInfo.join('\n')}`);

    const item = await this.findTreeItem(itemName, itemInfo);
    await this.validateFoundItem(item, itemName);
    await this.expandItemIfNeeded(item, itemName);

    DebugTestHelper.logger.success(`Tree item "${itemName}" found and processed`);
    return item;
  }

  // Configuration constants for retry behavior
  private static readonly ITEM_WAIT_MAX_RETRIES = 3;
  private static readonly ITEM_WAIT_DELAY_MS = 5000;
  private static readonly REFRESH_WAIT_MS = 1000;
  private static readonly PROGRESS_LOG_INTERVAL_MS = 3000;
  private static readonly POLL_INTERVAL_MS = 500;

  /**
   * Wait for items to be populated with retry logic for robustness
   */
  private async waitForItemsWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= DebugTestHelper.ITEM_WAIT_MAX_RETRIES; attempt++) {
      const allItems = await this.imageWatchSection!.getVisibleItems();

      if (allItems.length > 0) {
        return;
      }

      if (attempt < DebugTestHelper.ITEM_WAIT_MAX_RETRIES) {
        DebugTestHelper.logger.info(`No items found in Image Watch section, waiting... (attempt ${attempt}/${DebugTestHelper.ITEM_WAIT_MAX_RETRIES})`);
        await VSBrowser.instance.driver.sleep(DebugTestHelper.ITEM_WAIT_DELAY_MS);

        // Try refreshing the section
        try {
          const refreshButton = await this.imageWatchSection!.getAction('Refresh');
          if (refreshButton) {
            await refreshButton.click();
            await VSBrowser.instance.driver.sleep(DebugTestHelper.REFRESH_WAIT_MS);
          }
        }
        catch (e) {
          DebugTestHelper.logger.debug(`Could not refresh during wait: ${e}`);
        }
      }
    }

    // Don't throw here - let the calling code handle empty state
    DebugTestHelper.logger.warn('Image Watch section has no visible items after waiting');
  }

  private async getTreeItemDebugInfo(): Promise<string[]> {
    const allItems = await this.imageWatchSection!.getVisibleItems();
    const itemInfo: string[] = [];

    for (let i = 0; i < allItems.length; i++) {
      try {
        const label = await (allItems[i] as any).getLabel?.() || await (allItems[i] as any).getText?.() || '[Label unavailable]';
        const hasChildren = await (allItems[i] as TreeItem).hasChildren?.() || false;
        const isExpanded = await (allItems[i] as TreeItem).isExpanded?.() || false;
        itemInfo.push(`${i}: "${label}" (hasChildren: ${hasChildren}, expanded: ${isExpanded})`);
      }
      catch (e) {
        itemInfo.push(`${i}: [Error getting info: ${e}]`);
      }
    }

    return itemInfo;
  }

  private async findTreeItem(itemName: string, itemInfo: string[]): Promise<TreeItem> {
    // For container items (Variables/Expressions), try a shallow search first
    if (itemName === 'Variables' || itemName === 'Expressions') {
      const item = await this.findContainerItem(itemName);
      if (item)
        return item;
    }

    // Fallback to the original findItem method
    DebugTestHelper.logger.debug(`${itemName === 'Variables' || itemName === 'Expressions' ? 'Shallow search failed, f' : 'F'}alling back to findItem method for "${itemName}"`);

    const item = await this.imageWatchSection!.findItem(itemName) as TreeItem | undefined;

    if (!item) {
      DebugTestHelper.logger.error(`Tree item "${itemName}" not found using findItem method`);
      await this.takeScreenshot({
        name: `tree-item-not-found-${itemName.replace(/[^a-z0-9]/gi, '-')}`,
        element: 'screen',
      });
      throw new Error(`Tree item "${itemName}" not found. Available items:\n${itemInfo.join('\n')}`);
    }

    return item;
  }

  private async findContainerItem(itemName: string): Promise<TreeItem | undefined> {
    DebugTestHelper.logger.debug(`Performing shallow search for container "${itemName}"`);
    const allItems = await this.imageWatchSection!.getVisibleItems();

    for (const visibleItem of allItems) {
      const label = await (visibleItem as any).getLabel?.() || await (visibleItem as any).getText?.() || '';
      DebugTestHelper.logger.debug(`Checking visible item: "${label}"`);

      if (label === itemName || (label.toLowerCase().includes(itemName.toLowerCase()) && label !== 'x')) {
        DebugTestHelper.logger.success(`Found matching container item with label: "${label}"`);
        return visibleItem as TreeItem;
      }
    }

    return undefined;
  }

  private async validateFoundItem(item: TreeItem, itemName: string): Promise<void> {
    DebugTestHelper.logger.success(`Found item for "${itemName}", validating...`);

    const foundLabel = await (item as any).getLabel?.() || await (item as any).getText?.() || '[Label unavailable]';
    const hasChildren = await item.hasChildren?.() || false;
    const isExpanded = await item.isExpanded?.() || false;

    DebugTestHelper.logger.info(`Found item details: label="${foundLabel}", hasChildren=${hasChildren}, expanded=${isExpanded}`);

    // Critical validation: ensure we didn't get the wrong item
    if (foundLabel !== itemName && !foundLabel.includes(itemName)) {
      DebugTestHelper.logger.error(`CRITICAL: Found item label "${foundLabel}" doesn't match expected "${itemName}"`);
      await this.takeScreenshot({
        name: `wrong-item-found-expected-${itemName.replace(/[^a-z0-9]/gi, '-')}-got-${foundLabel.replace(/[^a-z0-9]/gi, '-')}`,
        element: 'screen',
      });
      throw new Error(`Found wrong item: expected "${itemName}", got "${foundLabel}"`);
    }

    // Validate this is actually a container (Variables/Expressions should have children)
    if ((itemName === 'Variables' || itemName === 'Expressions') && !hasChildren) {
      DebugTestHelper.logger.warn(`Warning: Container "${itemName}" has no children. This might indicate an issue.`);
      await this.takeScreenshot({
        name: `container-no-children-${itemName.replace(/[^a-z0-9]/gi, '-')}`,
        element: 'screen',
      });
    }
  }

  private async expandItemIfNeeded(item: TreeItem, itemName: string): Promise<void> {
    const hasChildren = await item.hasChildren?.() || false;
    const isExpanded = await item.isExpanded?.() || false;

    if (!hasChildren || isExpanded)
      return;

    DebugTestHelper.logger.step(`Expanding "${itemName}" container...`);
    await item.expand();
    await VSBrowser.instance.driver.sleep(1000);

    const isNowExpanded = await item.isExpanded();
    DebugTestHelper.logger.info(`Container "${itemName}" expanded: ${isNowExpanded}`);
  }

  /**
   * Find a variable and perform an action on it
   */
  async performVariableAction(options: VariableActionOptions): Promise<this> {
    const { variableName, actionLabel, retrySetup = true, setupRetries = 5, type } = options;

    DebugTestHelper.logger.step(`Finding variable "${variableName}" of type "${type}"`);

    const containerName = type === 'variable' ? 'Variables' : 'Expressions';
    DebugTestHelper.logger.debug(`Looking for container "${containerName}" for variable "${variableName}"`);

    const variablesItem = await this.findAndExpandTreeItem(containerName);
    await this.validateContainer(variablesItem, containerName, variableName);

    const variableItem = await this.findVariableWithRetries(variablesItem, variableName, containerName, type, retrySetup, setupRetries);
    await this.performActionOnVariable(variableItem, variableName, actionLabel);

    DebugTestHelper.logger.success(`Action "${actionLabel}" performed on variable "${variableName}"`);
    return this;
  }

  private async validateContainer(variablesItem: TreeItem, containerName: string, variableName: string): Promise<void> {
    const containerLabel = await (variablesItem as any).getLabel?.() || await (variablesItem as any).getText?.() || '[Label unavailable]';
    const containerHasChildren = await variablesItem.hasChildren?.() || false;

    DebugTestHelper.logger.info(`Container validation: expected="${containerName}", actual="${containerLabel}", hasChildren=${containerHasChildren}`);

    if (containerLabel === variableName) {
      DebugTestHelper.logger.error(`CRITICAL BUG DETECTED: Container search returned the variable "${variableName}" instead of container "${containerName}"`);
      DebugTestHelper.logger.error(`This means findItem("${containerName}") returned the "${variableName}" variable, which is incorrect.`);

      await this.takeScreenshot({
        name: `critical-container-bug-expected-${containerName.replace(/[^a-z0-9]/gi, '-')}-got-${variableName.replace(/[^a-z0-9]/gi, '-')}`,
        element: 'screen',
      });

      const debugInfo = await this.getTreeStructureDebugInfo();
      DebugTestHelper.logger.error(`Current tree structure:\n${debugInfo.join('\n')}`);
      throw new Error(`Container bug: findItem("${containerName}") returned variable "${variableName}" instead of the container`);
    }

    if (!containerLabel.includes(containerName) && containerLabel !== containerName) {
      DebugTestHelper.logger.warn(`Container label "${containerLabel}" doesn't match expected "${containerName}"`);
    }

    if (!containerHasChildren) {
      DebugTestHelper.logger.warn(`Container "${containerName}" has no children - this might indicate no variables are available`);
    }

    DebugTestHelper.logger.success(`Container validation passed`);
  }

  private async findVariableWithRetries(
    variablesItem: TreeItem,
    variableName: string,
    containerName: string,
    type: string,
    retrySetup: boolean,
    setupRetries: number,
  ): Promise<TreeItem> {
    let variableItem: TreeItem | undefined;

    for (let i = 0; i < setupRetries; i++) {
      DebugTestHelper.logger.step(`Attempt ${i + 1}/${setupRetries}: Looking for variable "${variableName}" in ${containerName}`);

      variableItem = await this.attemptFindVariable(variablesItem, variableName);
      if (variableItem) {
        DebugTestHelper.logger.success(`Variable "${variableName}" found on attempt ${i + 1}`);
        break;
      }

      variableItem = await this.handleSpecialVariableCase(variablesItem, variableName, type, i + 1);
      if (variableItem)
        break;

      if (retrySetup) {
        await this.handleVariableNotFoundRetry(variablesItem, variableName, containerName, i + 1);
      }
    }

    if (!variableItem) {
      await this.handleFinalVariableNotFound(variablesItem, variableName, containerName, setupRetries);
    }

    return variableItem!;
  }

  private async attemptFindVariable(variablesItem: TreeItem, variableName: string): Promise<TreeItem | undefined> {
    try {
      return (await variablesItem.findChildItem(variableName)) as TreeItem | undefined;
    }
    catch (findError) {
      DebugTestHelper.logger.error(`Error finding variable: ${findError}`);
      return undefined;
    }
  }

  private async handleSpecialVariableCase(variablesItem: TreeItem, variableName: string, type: string, attempt: number): Promise<TreeItem | undefined> {
    if (type !== 'variable')
      return undefined;

    const childItems = await variablesItem.getChildren().catch(() => []);
    const childLabels = await Promise.all(
      childItems.map(async (child) => {
        try {
          return await (child as any).getLabel?.() || await (child as any).getText?.() || '[Name unavailable]';
        }
        catch (e) {
          return '[Name unavailable]';
        }
      }),
    );

    const hasMetadataProperties = childLabels.some(label =>
      ['type', 'shape', 'dtype', 'size', 'ndim', 'device'].includes(label),
    );

    if (hasMetadataProperties && variableName === 'x') {
      DebugTestHelper.logger.debug(`Special case detected: Variables container appears to be the variable "${variableName}" itself`);
      DebugTestHelper.logger.info(`Children are metadata properties: [${childLabels.join(', ')}]`);
      DebugTestHelper.logger.success(`Using Variables container as variable "${variableName}" on attempt ${attempt}`);
      return variablesItem;
    }

    return undefined;
  }

  private async handleVariableNotFoundRetry(variablesItem: TreeItem, variableName: string, containerName: string, attempt: number): Promise<void> {
    DebugTestHelper.logger.warn(`Variable "${variableName}" not found, listing available variables and running setup (attempt ${attempt})`);

    const availableVars = await this.getAvailableVariables(variablesItem).catch(() => ['[Failed to list]']);
    DebugTestHelper.logger.info(`Available variables in ${containerName}: [${availableVars.join(', ')}]`);

    await this.takeScreenshot({
      name: `variable-not-found-attempt-${attempt}-${variableName.replace(/[^a-z0-9]/gi, '-')}`,
      element: 'screen',
    });

    await new Workbench().executeCommand('svifpd.run-setup');
    await VSBrowser.instance.driver.sleep(500);
    await this.refreshImageWatch();
  }

  private async handleFinalVariableNotFound(variablesItem: TreeItem, variableName: string, containerName: string, setupRetries: number): Promise<never> {
    DebugTestHelper.logger.error(`Variable "${variableName}" not found after ${setupRetries} attempts`);

    const finalAvailableVars = await this.getAvailableVariables(variablesItem)
      .catch((finalListError) => {
        throw new Error(`Variable "${variableName}" not found after ${setupRetries} attempts and failed to list available variables: ${finalListError}`);
      });

    DebugTestHelper.logger.info(`Final check - Available variables in ${containerName}: [${finalAvailableVars.join(', ')}]`);

    await this.takeScreenshot({
      name: `variable-not-found-final-${variableName.replace(/[^a-z0-9]/gi, '-')}`,
      element: 'screen',
    });

    throw new Error(`Variable "${variableName}" not found after ${setupRetries} attempts. Available variables: [${finalAvailableVars.join(', ')}]`);
  }

  private async performActionOnVariable(variableItem: TreeItem, variableName: string, actionLabel: string): Promise<void> {
    DebugTestHelper.logger.step(`Variable "${variableName}" found`);
    DebugTestHelper.logger.step(`Getting action buttons for "${variableName}"`);

    const buttons = await variableItem.getActionButtons();
    DebugTestHelper.logger.info(`Found ${buttons.length} action buttons for variable "${variableName}"`);

    const availableActions: string[] = [];

    for (const btn of buttons) {
      const label = await btn.getLabel().catch(() => '[Button label unavailable]');
      availableActions.push(label);
      DebugTestHelper.logger.step(`Found button label: "${label}"`);

      if (label === actionLabel) {
        DebugTestHelper.logger.step(`Clicking "${actionLabel}" button`);
        await btn.click();
        await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
        return;
      }
    }

    DebugTestHelper.logger.error(`Action "${actionLabel}" not found. Available actions: [${availableActions.join(', ')}]`);
    await this.takeScreenshot({
      name: `action-not-found-${actionLabel.replace(/[^a-z0-9]/gi, '-')}-on-${variableName.replace(/[^a-z0-9]/gi, '-')}`,
      element: 'screen',
    });
    throw new Error(`Action "${actionLabel}" not found. Available actions: [${availableActions.join(', ')}]`);
  }

  private async getAvailableVariables(variablesItem: TreeItem): Promise<string[]> {
    const childItems = await variablesItem.getChildren();
    return Promise.all(
      childItems.map(async (child) => {
        try {
          return await (child as any).getLabel?.() || await (child as any).getText?.() || '[Name unavailable]';
        }
        catch (e) {
          return '[Name unavailable]';
        }
      }),
    );
  }

  private async getTreeStructureDebugInfo(): Promise<string[]> {
    const allItems = await this.imageWatchSection!.getVisibleItems();
    const debugInfo: string[] = [];

    for (let idx = 0; idx < allItems.length; idx++) {
      try {
        const label = await (allItems[idx] as any).getLabel?.() || await (allItems[idx] as any).getText?.() || '[Label unavailable]';
        const hasChildren = await (allItems[idx] as TreeItem).hasChildren?.() || false;
        debugInfo.push(`${idx}: "${label}" (hasChildren: ${hasChildren})`);
      }
      catch (e) {
        debugInfo.push(`${idx}: [Error: ${e}]`);
      }
    }

    return debugInfo;
  }

  // =============================================================================
  // EXPRESSION MANAGEMENT
  // =============================================================================

  /**
   * Add an expression through the command palette
   */
  async addExpression(options: ExpressionOptions): Promise<this> {
    const { expression, timeout = this.options.timeout } = options;

    DebugTestHelper.logger.step(`Adding expression "${expression}"`);

    // Execute the add expression command
    await new Workbench().executeCommand('svifpd.add-expression');
    await VSBrowser.instance.driver.sleep(500);

    // Wait for input box and enter the expression
    try {
      const input = await InputBox.create(timeout);
      await input.setText(expression);
      await input.confirm();
      await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);

      DebugTestHelper.logger.step(`Expression "${expression}" added`);
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
    DebugTestHelper.logger.step(`Editing expression from "${oldExpression}" to "${newExpression}"`);

    // This would typically involve finding the expression in the tree and using edit action
    // Implementation details depend on the exact UI structure
    await new Workbench().executeCommand('svifpd.edit-expression');
    await VSBrowser.instance.driver.sleep(500);

    try {
      const input = await InputBox.create();
      await input.setText(newExpression);
      await input.confirm();
      await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);

      DebugTestHelper.logger.step(`Expression edited to "${newExpression}"`);
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
    DebugTestHelper.logger.step('Finding Image View webview');

    const editorView = new EditorView();
    let webviewEditor: Editor | undefined;

    const groups = await editorView.getEditorGroups();
    DebugTestHelper.logger.info(`Found ${groups.length} editor groups`);

    // Search through all editor groups
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const titles = await group.getOpenEditorTitles();
      DebugTestHelper.logger.info(`Group ${i} has open editors: [${titles.join(', ')}]`);

      if (titles.includes('Image View')) {
        DebugTestHelper.logger.success(`Found 'Image View' in group ${i}`);
        webviewEditor = await group.openEditor('Image View');
        if (webviewEditor) {
          this.webviewTab = await this.findImageWebviewTab();
          break;
        }
      }
    }

    if (!webviewEditor) {
      DebugTestHelper.logger.error('Image View webview is not open. Taking screenshot of current state...');

      // Log all open editors for debugging
      const allOpenTitles: string[] = [];
      for (let i = 0; i < groups.length; i++) {
        const groupTitles = await groups[i].getOpenEditorTitles();
        allOpenTitles.push(...groupTitles.map(title => `Group${i}:${title}`));
      }
      DebugTestHelper.logger.info(`All open editors: [${allOpenTitles.join(', ')}]`);

      await this.takeScreenshot({
        name: 'webview-not-found',
        element: 'screen',
      });

      throw new Error(`Image View webview is not open. Available editors: [${allOpenTitles.join(', ')}]`);
    }

    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    DebugTestHelper.logger.success('Image View webview found and focused');
    return this;
  }

  /**
   * Wait for the Image View webview to open
   */
  async waitForImageWebview(): Promise<this> {
    DebugTestHelper.logger.step('Waiting for Image View webview to open');

    let attempts = 0;
    const maxAttempts = Math.floor(this.options.timeout! / 1000);

    const webviewTab = await VSBrowser.instance.driver.wait(async () => {
      attempts++;
      DebugTestHelper.logger.step(`Waiting for webview - attempt ${attempts}/${maxAttempts}`);

      const tab = await this.findImageWebviewTab();
      if (!tab) {
        // Log current editor state every 5 attempts
        if (attempts % 5 === 0) {
          const editorView = new EditorView();
          const groups = await editorView.getEditorGroups();
          const allTitles: string[] = [];

          for (let i = 0; i < groups.length; i++) {
            const groupTitles = await groups[i].getOpenEditorTitles();
            allTitles.push(...groupTitles.map(title => `Group${i}:${title}`));
          }

          DebugTestHelper.logger.info(`Attempt ${attempts}: Still waiting for webview. Current editors: [${allTitles.join(', ')}]`);
        }
      }

      return tab;
    }, this.options.timeout!, 'Image View webview did not open in time', 1000);

    if (!webviewTab) {
      DebugTestHelper.logger.error('Image View webview did not open in time. Taking final screenshot...');
      await this.takeScreenshot({
        name: 'webview-wait-timeout',
        element: 'screen',
      });
      throw new Error('Image View webview did not open in time');
    }

    this.webviewTab = webviewTab;
    DebugTestHelper.logger.success('Image View webview opened');
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
      DebugTestHelper.logger.warn(`Error finding Image View webview tab: ${error}`);
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

    DebugTestHelper.logger.step('Interacting with webview');
    // Placeholder for specific webview interactions
    // This could include clicking buttons, changing settings, etc.
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    DebugTestHelper.logger.step('Webview interaction completed');
    return this;
  }

  // =============================================================================
  // SCREENSHOT OPERATIONS
  // =============================================================================

  /**
   * Take a screenshot of the current webview or editor
   */
  async takeScreenshot(options: ScreenshotOptions): Promise<this> {
    const { name, element, testPrefix } = options;

    // Use test prefix from options, or fall back to current test name, or default
    const prefix = testPrefix || this.currentTestName || 'test';
    const fullName = `${prefix}-${name}`;

    DebugTestHelper.logger.screenshot(`Taking screenshot "${fullName}"`);

    const screenshot = element === 'screen'
      ? await VSBrowser.instance.driver.takeScreenshot()
      : await element.takeScreenshot();

    await writeScreenshot(screenshot, fullName);
    DebugTestHelper.logger.screenshot(`Screenshot "${fullName}" saved`);
    return this;
  }

  // =============================================================================
  // COMMAND EXECUTION
  // =============================================================================

  /**
   * Execute a VS Code command
   */
  async executeCommand(command: string): Promise<this> {
    DebugTestHelper.logger.step(`Executing command "${command}"`);
    await new Workbench().executeCommand(command);
    await VSBrowser.instance.driver.sleep(this.options.sleepDuration!);
    DebugTestHelper.logger.step(`Command "${command}" executed`);
    return this;
  }

  // =============================================================================
  // DEBUG STATE ACCESS METHODS
  // =============================================================================

  /**
   * Get debug state information for error reporting
   */
  async getDebugStateInfo(): Promise<string[]> {
    const stateInfo: string[] = [];

    try {
      if (this.debugView) {
        stateInfo.push('Debug view is available');
        const sections = await this.debugView.getContent().getSections();
        const sectionTitles = await Promise.all(
          sections.map(async (section) => {
            try {
              return await section.getTitle();
            }
            catch (e) {
              return '[Title unavailable]';
            }
          }),
        );
        stateInfo.push(`Available debug sections: [${sectionTitles.join(', ')}]`);
      }
      else {
        stateInfo.push('Debug view not available');
      }

      if (this.debugToolbar) {
        stateInfo.push('Debug toolbar is available');
      }
      else {
        stateInfo.push('Debug toolbar not available');
      }

      if (this.imageWatchSection) {
        stateInfo.push('Image Watch section is available');
        const isExpanded = await this.imageWatchSection.isExpanded();
        stateInfo.push(`Image Watch section expanded: ${isExpanded}`);
      }
      else {
        stateInfo.push('Image Watch section not available');
      }

      if (this.webviewTab) {
        stateInfo.push('Webview tab is available');
        try {
          const title = await this.webviewTab.getTitle();
          stateInfo.push(`Webview title: "${title}"`);
        }
        catch (e) {
          stateInfo.push('Webview title unavailable');
        }
      }
      else {
        stateInfo.push('Webview tab not available');
      }
    }
    catch (error) {
      stateInfo.push(`Error getting debug state: ${error}`);
    }

    return stateInfo;
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
   * Static logger object for structured test output with emoji prefixes
   */
  static logger = {
    testStart: (message: string) => {
      console.log(`🚀 Test Start: ${message}`);
    },
    step: (message: string) => {
      console.log(`🔹 Step: ${message}`);
    },
    error: (message: string) => {
      console.error(`❌ Error: ${message}`);
    },
    info: (message: string) => {
      console.info(`ℹ️ Info: ${message}`);
    },
    warn: (message: string) => {
      console.warn(`⚠️ Warning: ${message}`);
    },
    success: (message: string) => {
      console.log(`✅ Success: ${message}`);
    },
    debug: (message: string) => {
      console.debug(`🐞 Debug: ${message}`);
    },
    screenshot: (message: string) => {
      console.log(`📸 Screenshot: ${message}`);
    },
    variable: (message: string) => {
      console.log(`🧬 Variable: ${message}`);
    },
    expression: (message: string) => {
      console.log(`📝 Expression: ${message}`);
    },
    webview: (message: string) => {
      console.log(`🌐 Webview: ${message}`);
    },
    validating: (message: string) => {
      console.log(`🔍 Validating: ${message}`);
    },
    cleanup: (message: string) => {
      console.log(`🧹 Cleanup: ${message}`);
    },
    custom: (emoji: string, message: string) => {
      console.log(`${emoji} ${message}`);
    },
  };

  /**
   * Helper method for sleep
   */
  sleep(ms: number) {
    return VSBrowser.instance.driver.sleep(ms);
  }

  // =============================================================================
  // VALIDATION AND AUTO-ENSURING METHODS
  // =============================================================================

  /**
   * Ensure the debug view is open and accessible
   */
  async ensureDebugViewOpen(): Promise<this> {
    if (!this.debugView || !await this.isViewValid(this.debugView)) {
      DebugTestHelper.logger.step('Debug view not valid, opening debug panel');
      await this.openDebugPanel();
    }
    else {
      DebugTestHelper.logger.step('Debug view already open and valid');
    }
    return this;
  }

  /**
   * Ensure the Image Watch section is expanded and accessible
   */
  async ensureImageWatchSectionExpanded(): Promise<this> {
    await this.ensureDebugViewOpen();

    if (!this.imageWatchSection || !await this.isSectionValid(this.imageWatchSection)) {
      DebugTestHelper.logger.step('Image Watch section not valid, expanding section');
      await this.expandImageWatchSection();
    }
    else {
      DebugTestHelper.logger.step('Image Watch section already expanded and valid');
    }
    return this;
  }

  /**
   * Ensure the webview is open and accessible
   */
  async ensureWebviewOpen(): Promise<this> {
    if (!this.webviewTab || !await this.isWebviewValid()) {
      DebugTestHelper.logger.step('Webview not valid, finding/opening webview');
      try {
        await this.findImageWebview();
      }
      catch (error) {
        DebugTestHelper.logger.step('Webview not found, waiting for it to open');
        await this.waitForImageWebview();
      }
    }
    else {
      DebugTestHelper.logger.step('Webview already open and valid');
    }
    return this;
  }

  /**
   * Check if a view section is valid and accessible
   */
  private async isViewValid(view: DebugView): Promise<boolean> {
    try {
      // Try to interact with the view to see if it's valid
      await view.isDisplayed();
      return true;
    }
    catch (error) {
      return false;
    }
  }

  /**
   * Check if a section is valid and accessible
   */
  private async isSectionValid(section: ViewSection): Promise<boolean> {
    try {
      // Try to interact with the section to see if it's valid
      return await section.isDisplayed() && await section.isExpanded();
    }
    catch (error) {
      return false;
    }
  }

  /**
   * Check if the webview is valid and accessible
   */
  private async isWebviewValid(): Promise<boolean> {
    try {
      if (!this.webviewTab)
        return false;
      // Try to get title to see if tab is still valid
      await this.webviewTab.getTitle();
      return true;
    }
    catch (error) {
      return false;
    }
  }

  // =============================================================================
  // HIGH-LEVEL ORCHESTRATION METHODS
  // =============================================================================

  /**
   * High-level method to set up editor for debugging
   */
  async setupEditorForDebug(options: SetupEditorOptions): Promise<this> {
    const { fileName, debugConfig = 'Python: Current File', openFile = true } = options;

    DebugTestHelper.logger.step(`Setting up editor for debug - ${fileName}`);

    // Open file if requested
    if (openFile) {
      await this.openFile(fileName);
    }
    try {
      await this.openEditor(basename(fileName));
    }
    catch (error) {
      DebugTestHelper.logger.warn(`Could not open editor for ${fileName}: ${error}`);
      const editorView = new EditorView();
      const openedEditors = await editorView.getOpenEditorTitles();
      DebugTestHelper.logger.info(`Opened editors: ${openedEditors.join(', ')}`);
      throw error;
    }

    // Set up debug configuration
    await this.ensureDebugViewOpen();
    await this.selectLaunchConfiguration(debugConfig);

    DebugTestHelper.logger.step(`Editor setup completed for ${fileName}`);
    return this;
  }

  /**
   * High-level method to get webview, ensuring it's open
   */
  async getWebview(options: WebviewOptions = {}): Promise<this> {
    const { autoOpen = true } = options;

    DebugTestHelper.logger.step('Getting webview');

    if (autoOpen) {
      await this.ensureWebviewOpen();
    }
    else {
      if (!this.webviewTab) {
        throw new Error('Webview not available and autoOpen is disabled');
      }
    }

    DebugTestHelper.logger.step('Webview is ready');
    return this;
  }

  async getWebviewEditor() {
    DebugTestHelper.logger.step('Getting Image View webview editor');

    const editorView = new EditorView();
    let webviewEditor: Editor | undefined;
    const groups = await editorView.getEditorGroups();

    DebugTestHelper.logger.info(`Searching for Image View editor across ${groups.length} editor groups`);

    // Search through all editor groups for Image View
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const titles = await group.getOpenEditorTitles();
      DebugTestHelper.logger.info(`Group ${i} editors: [${titles.join(', ')}]`);

      if (titles.includes('Image View')) {
        DebugTestHelper.logger.success(`Found 'Image View' in group ${i}, attempting to open...`);
        webviewEditor = await group.openEditor('Image View');
        if (webviewEditor) {
          DebugTestHelper.logger.success('Successfully opened Image View editor');
          break;
        }
        DebugTestHelper.logger.warn('Failed to open Image View editor in this group');
      }
    }

    if (!webviewEditor) {
      DebugTestHelper.logger.error('Image View editor is not open. Logging current state...');

      // Log all available editors
      const allEditors: string[] = [];
      for (let i = 0; i < groups.length; i++) {
        const groupTitles = await groups[i].getOpenEditorTitles();
        allEditors.push(...groupTitles.map(title => `Group${i}:${title}`));
      }
      DebugTestHelper.logger.info(`All available editors: [${allEditors.join(', ')}]`);

      await this.takeScreenshot({
        name: 'webview-editor-not-found',
        element: 'screen',
      });

      throw new Error(`Image View editor is not open. Available editors: [${allEditors.join(', ')}]`);
    }

    DebugTestHelper.logger.success('Image View webview editor obtained successfully');
    return webviewEditor;
  }

  /**
   * High-level method to start a complete debug session
   */
  async startCompleteDebugSession(options: SetupEditorOptions): Promise<this> {
    DebugTestHelper.logger.step('Starting complete debug session');

    await this.setupEditorForDebug(options);
    await this.startDebugging();
    await this.waitForBreakpoint();
    await this.ensureImageWatchSectionExpanded();

    DebugTestHelper.logger.step('Complete debug session started');
    return this;
  }

  /**
   * Clean up resources - enhanced to close all editors and reset VS Code state
   */
  async cleanup(): Promise<void> {
    DebugTestHelper.logger.cleanup('Starting comprehensive cleanup of DebugTestHelper resources');

    // Stop debugging if still active
    if (this.debugToolbar) {
      try {
        await this.stopDebugging();
      }
      catch (error) {
        DebugTestHelper.logger.warn(`Error stopping debugger during cleanup: ${error}`);
      }
    }

    // Close all editors
    try {
      DebugTestHelper.logger.cleanup('Closing all editors');
      const editorView = new EditorView();
      await editorView.closeAllEditors();
    }
    catch (error) {
      DebugTestHelper.logger.warn(`Error closing editors during cleanup: ${error}`);
    }

    // Try to close any open dialogs or input boxes
    DebugTestHelper.logger.cleanup('Dismissing any open dialogs');
    await new Workbench().executeCommand('workbench.action.closeQuickOpen');

    // Reset the workbench to a clean state
    DebugTestHelper.logger.cleanup('Resetting workbench state');
    await new Workbench().executeCommand('workbench.action.resetViewLocations');

    // Wait a bit for everything to settle
    await VSBrowser.instance.driver.sleep(1000);

    // Reset internal state
    this.debugView = null;
    this.debugToolbar = null;
    this.imageWatchSection = null;
    this.currentEditor = null;
    this.webviewTab = null;
    this.currentTestName = 'unknown-test';

    DebugTestHelper.logger.cleanup('Comprehensive DebugTestHelper cleanup completed');
  }
}
