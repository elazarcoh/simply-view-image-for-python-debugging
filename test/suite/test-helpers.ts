import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getPythonTemplate } from '../test-data/python-templates';

/**
 * Test utilities for Simply View Image extension testing
 */

export class TestHelper {
  /**
   * Wait for a specified amount of time
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for extension to be activated
   */
  static async waitForExtensionActivation(extensionId: string): Promise<vscode.Extension<any>> {
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found`);
    }

    if (!extension.isActive) {
      await extension.activate();
    }

    return extension;
  }

  /**
   * Wait for a debug session to be active
   */
  static async waitForDebugSession(timeout: number = 15000): Promise<vscode.DebugSession> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error('Timeout waiting for debug session'));
      }, timeout);

      if (vscode.debug.activeDebugSession) {
        clearTimeout(timeoutHandle);
        resolve(vscode.debug.activeDebugSession);
        return;
      }

      const disposable = vscode.debug.onDidChangeActiveDebugSession((session) => {
        if (session) {
          clearTimeout(timeoutHandle);
          disposable.dispose();
          resolve(session);
        }
      });
    });
  }

  /**
   * Wait for debug session to terminate
   */
  static async waitForDebugSessionEnd(timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error('Timeout waiting for debug session to end'));
      }, timeout);

      if (!vscode.debug.activeDebugSession) {
        clearTimeout(timeoutHandle);
        resolve();
        return;
      }

      const disposable = vscode.debug.onDidTerminateDebugSession(() => {
        clearTimeout(timeoutHandle);
        disposable.dispose();
        resolve();
      });
    });
  }

  /**
   * Check if Python extension is available
   */
  static isPythonExtensionAvailable(): boolean {
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    return !!pythonExtension;
  }

  /**
   * Get test data directory path
   */
  static getTestDataPath(): string {
    return path.join(__dirname, '../../test-data');
  }

  /**
   * Get test fixtures directory path
   */
  static getTestFixturesPath(): string {
    return path.join(__dirname, '../../test-data/fixtures');
  }

  /**
   * Create a temporary test file
   */
  static async createTempTestFile(filename: string, content: string): Promise<string> {
    const tempDir = path.join(__dirname, '../../test-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * Clean up temporary test files
   */
  static cleanupTempFiles(): void {
    const tempDir = path.join(__dirname, '../../test-temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Execute a command safely (catches errors)
   */
  static async executeCommandSafely(command: string, ...args: any[]): Promise<{ success: boolean; result?: any; error?: Error }> {
    try {
      const result = await vscode.commands.executeCommand(command, ...args);
      return { success: true, result };
    }
    catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Create a basic Python debug configuration
   */
  static createPythonDebugConfig(scriptPath: string, name: string = 'Test Debug'): vscode.DebugConfiguration {
    return {
      type: 'python',
      request: 'launch',
      name,
      program: scriptPath,
      console: 'integratedTerminal',
      stopOnEntry: false,
      cwd: path.dirname(scriptPath),
      python: 'python', // Use default Python
    };
  }

  /**
   * Start a debug session and wait for it to be active
   */
  static async startDebugSession(config: vscode.DebugConfiguration): Promise<vscode.DebugSession> {
    const started = await vscode.debug.startDebugging(undefined, config);
    if (!started) {
      throw new Error('Failed to start debug session');
    }

    return this.waitForDebugSession();
  }

  /**
   * Stop all active debug sessions
   */
  static async stopAllDebugSessions(): Promise<void> {
    const activeSessions = vscode.debug.activeDebugSession;
    if (activeSessions) {
      await vscode.debug.stopDebugging(activeSessions);
      await this.waitForDebugSessionEnd();
    }
  }

  /**
   * Check if a command is registered
   */
  static async isCommandRegistered(command: string): Promise<boolean> {
    const commands = await vscode.commands.getCommands();
    return commands.includes(command);
  }

  /**
   * Get extension configuration
   */
  static getExtensionConfig(section?: string): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('svifpd', section ? vscode.Uri.parse(section) : undefined);
  }

  /**
   * Set extension configuration temporarily
   */
  static async setConfigTemporarily<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<() => Promise<void>> {
    const config = this.getExtensionConfig();
    const originalValue = config.get(key);

    await config.update(key, value, target);

    // Return a cleanup function
    return async () => {
      await config.update(key, originalValue, target);
    };
  }

  /**
   * Wait for a condition to be true
   */
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.sleep(interval);
    }

    throw new Error('Timeout waiting for condition');
  }

  /**
   * Simulate user action with delay
   */
  static async simulateUserAction<T>(action: () => Promise<T>, delay: number = 500): Promise<T> {
    await this.sleep(delay);
    const result = await action();
    await this.sleep(delay);
    return result;
  }

  /**
   * Create a mock workspace folder for testing
   */
  static createMockWorkspace(path: string): vscode.WorkspaceFolder {
    return {
      uri: vscode.Uri.file(path),
      name: 'Test Workspace',
      index: 0,
    };
  }

  /**
   * Verify extension health (no crashes, basic functionality)
   */
  static async verifyExtensionHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if extension is active
    const extension = vscode.extensions.getExtension('elazarcoh.simply-view-image-for-python-debugging');
    if (!extension?.isActive) {
      issues.push('Extension is not active');
    }

    // Check if basic commands are registered
    const basicCommands = ['svifpd.open-settings', 'svifpd.open-image-webview'];
    for (const command of basicCommands) {
      if (!(await this.isCommandRegistered(command))) {
        issues.push(`Command ${command} is not registered`);
      }
    }

    // Check if configuration is accessible
    try {
      const config = this.getExtensionConfig();
      config.get('debug'); // Just try to access a config value
    }
    catch {
      issues.push('Extension configuration is not accessible');
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate a basic Python test script content
   */
  static generateBasicPythonScript(): string {
    return getPythonTemplate('basicScript');
  }

  /**
   * Generate a complex Python test script
   */
  static generateComplexPythonScript(): string {
    return getPythonTemplate('complexScript');
  }

  /**
   * Generate an error-testing Python script
   */
  static generateErrorTestScript(): string {
    return getPythonTemplate('errorTestScript');
  }

  /**
   * Generate a performance testing Python script
   */
  static generatePerformanceTestScript(): string {
    return getPythonTemplate('performanceScript');
  }

  /**
   * Generate a tensor-specific testing Python script
   */
  static generateTensorTestScript(): string {
    return getPythonTemplate('tensorScript');
  }

  /**
   * Generate a plotting and visualization testing Python script
   */
  static generatePlotTestScript(): string {
    return getPythonTemplate('plotScript');
  }
}
