import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
  static async waitForExtensionActivation(extensionId: string, timeout: number = 10000): Promise<vscode.Extension<any>> {
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
    } catch (error) {
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
      python: 'python' // Use default Python
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
    interval: number = 100
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
      index: 0
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
    } catch (error) {
      issues.push('Extension configuration is not accessible');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }
}

/**
 * Test fixtures and data generators
 */
export class TestData {
  /**
   * Generate a basic Python test script content
   */
  static generateBasicPythonScript(): string {
    return `
import numpy as np
try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

# Create test data
numpy_image = np.random.randint(0, 255, (50, 50, 3), dtype=np.uint8)
print("Created numpy image:", numpy_image.shape)

if Image:
    pil_image = Image.fromarray(numpy_image)
    print("Created PIL image:", pil_image.size)

if plt:
    fig, ax = plt.subplots()
    x = np.linspace(0, 10, 50)
    ax.plot(x, np.sin(x))
    ax.set_title("Test Plot")
    print("Created matplotlib plot")

print("Test data created - set breakpoint here")
`;
  }

  /**
   * Generate a complex Python test script
   */
  static generateComplexPythonScript(): string {
    return `
import numpy as np
try:
    from PIL import Image
    import matplotlib.pyplot as plt
    import plotly.graph_objects as go
except ImportError as e:
    print(f"Import warning: {e}")

class TestDataContainer:
    def __init__(self):
        self.create_images()
        self.create_plots()
        self.create_tensors()
    
    def create_images(self):
        # Various image formats
        self.gray_image = np.random.randint(0, 255, (100, 100), dtype=np.uint8)
        self.rgb_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        self.float_image = np.random.random((100, 100)).astype(np.float32)
        
        try:
            self.pil_image = Image.fromarray(self.rgb_image)
        except:
            self.pil_image = None
    
    def create_plots(self):
        try:
            self.fig, self.ax = plt.subplots(figsize=(8, 6))
            x = np.linspace(0, 10, 100)
            self.ax.plot(x, np.sin(x), 'b-', label='sin')
            self.ax.plot(x, np.cos(x), 'r--', label='cos')
            self.ax.legend()
            self.ax.set_title('Trigonometric Functions')
        except:
            self.fig, self.ax = None, None
    
    def create_tensors(self):
        self.tensor_1d = np.array([1, 2, 3, 4, 5])
        self.tensor_2d = np.random.random((5, 5))
        self.tensor_3d = np.random.random((2, 3, 4))
        self.tensor_4d = np.random.random((2, 2, 3, 3))

# Create test data instance
test_data = TestDataContainer()
print("Complex test data created - set breakpoint here")
`;
  }

  /**
   * Generate an error-testing Python script
   */
  static generateErrorTestScript(): string {
    return `
import numpy as np

def test_edge_cases():
    # Edge cases that might cause issues
    empty_array = np.array([])
    print("Empty array:", empty_array.shape)
    
    single_pixel = np.array([[255]], dtype=np.uint8)
    print("Single pixel:", single_pixel.shape)
    
    # Arrays with special values
    nan_array = np.full((10, 10), np.nan)
    inf_array = np.full((10, 10), np.inf)
    
    # Very large array (commented to avoid memory issues)
    # large_array = np.random.random((1000, 1000, 3))
    
    # Invalid shapes for images
    invalid_shape = np.random.random((10, 10, 5))  # 5 channels
    
    print("Edge case data created - set breakpoint here")

test_edge_cases()
`;
  }
}