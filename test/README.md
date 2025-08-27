# Test Suite for Simply View Image Extension

This directory contains a comprehensive end-to-end test suite for the VS Code extension "Simply View Image for Python Debugging".

## Overview

The test suite validates the complete workflow from Python environment setup through debugging, extension activation, command execution, and webview interaction using the `vscode-extension-tester` framework.

## Test Structure

```
test/
├── suite/                          # TypeScript test files
│   ├── extension.test.ts           # Extension activation tests
│   ├── commands.test.ts            # Command execution tests
│   ├── debug-integration.test.ts   # Python debugging integration
│   ├── webview.test.ts            # Webview functionality tests
│   ├── test-helpers.ts            # Test utilities and helpers
│   └── index.ts                   # Test runner configuration
├── test-data/                     # Test data and fixtures
│   ├── generate_test_data.py      # Python script to generate test data
│   ├── fixtures/                  # Generated Python test scripts
│   └── test_metadata.json         # Test data metadata
├── test-env/                      # Python virtual environment (created)
├── setup-python-env.sh           # Python environment setup script
├── runTest.ts                     # VS Code test runner
└── tsconfig.json                  # TypeScript configuration for tests
```

## Quick Start

### 1. Setup and Run All Tests

```bash
yarn test:e2e
```

This command will:

- Set up the Python test environment
- Generate test data
- Compile TypeScript tests
- Run the complete test suite

### 2. Individual Commands

```bash
# Setup Python environment
yarn test:setup-python

# Generate test data
yarn test:generate-data

# Compile tests only
yarn compile-tests

# Run tests only (after setup)
yarn test:unit
```

## Test Categories

### Extension Activation Tests (`extension.test.ts`)

- Extension loading and activation
- Command registration verification
- Configuration availability
- Tree view provider registration

### Command Tests (`commands.test.ts`)

- All extension commands execution
- Error handling validation
- Command availability checks
- Rapid command execution resilience

### Debug Integration Tests (`debug-integration.test.ts`)

- Python debugger session management
- Extension setup during debugging
- Multi-session handling
- Debug session lifecycle

### Webview Tests (`webview.test.ts`)

- Webview panel creation and management
- Security settings validation
- Resource loading
- State management

## Python Test Environment

The test suite automatically creates a Python virtual environment with the following packages:

### Core Dependencies

- `numpy` - Array processing
- `Pillow` - Image processing
- `matplotlib` - Plotting
- `plotly` - Interactive plots

### Optional Dependencies (installed if available)

- `torch` + `torchvision` - PyTorch tensors
- `tensorflow` - TensorFlow tensors
- `scikit-image` - Image processing
- `opencv-python` - Computer vision
- `imageio` - Image I/O

## Test Data Generation

The `generate_test_data.py` script creates:

1. **Numpy arrays** with various shapes and data types
2. **PIL Images** in different formats
3. **Matplotlib figures** with different plot types
4. **Plotly plots** for interactive visualization
5. **Tensor data** from numpy, PyTorch, and TensorFlow
6. **Python test scripts** for debugging scenarios

## Manual Testing

### Using VS Code Tasks

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run "Tasks: Run Task"
3. Select from available tasks:
   - "Setup Python Test Environment"
   - "Generate Test Data"
   - "Compile Tests"
   - "Run E2E Tests"

### Using Launch Configurations

1. Open the Debug view (`Ctrl+Shift+D`)
2. Select "Extension Tests" configuration
3. Press F5 to run tests with debugging

## Test Configuration

### VS Code Test Settings

The test runner is configured in `.vscode/launch.json`:

- Uses test workspace folder
- Loads extension in development mode
- Enables test environment variables

### TypeScript Configuration

Tests use a separate TypeScript configuration (`test/tsconfig.json`):

- CommonJS modules for Node.js compatibility
- ES2020 target for modern features
- Strict type checking enabled

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/test.yml` workflow:

- Tests on Ubuntu, Windows, and macOS
- Tests multiple Python versions (3.8-3.12)
- Tests multiple Node.js versions
- Runs security audits
- Builds and packages extension

### Matrix Testing

The CI pipeline tests combinations of:

- Operating systems: Ubuntu, Windows, macOS
- Python versions: 3.8, 3.9, 3.10, 3.11, 3.12
- Node.js versions: 18, 20

## Test Utilities

The `test-helpers.ts` file provides utilities for:

### Timing and Synchronization

- `sleep()` - Wait for specified time
- `waitForExtensionActivation()` - Wait for extension to activate
- `waitForDebugSession()` - Wait for debug session to start
- `waitForCondition()` - Wait for custom conditions

### Debug Session Management

- `startDebugSession()` - Start Python debug session
- `stopAllDebugSessions()` - Clean up debug sessions
- `createPythonDebugConfig()` - Create debug configurations

### Command and Configuration

- `executeCommandSafely()` - Execute commands with error handling
- `isCommandRegistered()` - Check command availability
- `setConfigTemporarily()` - Temporarily modify settings

### Test Data and Fixtures

- `createTempTestFile()` - Create temporary test files
- `generateBasicPythonScript()` - Generate test Python scripts
- `verifyExtensionHealth()` - Check extension status

## Troubleshooting

### Common Issues

1. **Python Environment Setup Fails**

   ```bash
   # Manually create environment
   cd test
   python -m venv test-env
   source test-env/bin/activate  # or test-env\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. **Test Compilation Errors**

   ```bash
   # Clean and rebuild
   yarn clean
   yarn compile-tests
   ```

3. **VS Code Extension Test Failures**
   - Ensure VS Code is not running during tests
   - Check Python extension is installed
   - Verify test data was generated correctly

4. **Webview Tests Fail**
   - May require display server on Linux (uses xvfb in CI)
   - Check extension webview functionality manually first

### Debug Mode

Run tests with additional debugging:

```bash
# Enable debug logging
NODE_ENV=test DEBUG=* yarn test:unit

# Run specific test file
yarn compile-tests
./node_modules/.bin/mocha out/test/suite/extension.test.js
```

### Test Data Verification

Check generated test data:

```bash
cd test
python -c "import json; print(json.load(open('test-data/test_metadata.json', 'r')))"
```

## Contributing

When adding new tests:

1. **Follow the existing structure** - Use the same patterns as existing tests
2. **Use test helpers** - Leverage utilities in `test-helpers.ts`
3. **Handle errors gracefully** - Tests should be resilient to environment issues
4. **Update documentation** - Add new test categories to this README
5. **Test across platforms** - Ensure tests work on Windows, macOS, and Linux

## Performance Considerations

- Tests timeout after 60 seconds by default
- Python environment setup may take 2-3 minutes
- Large test matrices in CI can take 30+ minutes
- Use `continue-on-error` for optional components

## Security

- No secrets or credentials in test code
- Python packages installed from trusted sources
- Test isolation prevents interference
- Temporary files cleaned up automatically
