# Python Debug Test

This directory contains tests for Python debugging functionality in VS Code.

## Files

- `debug_test.py` - A simple Python script that sets a variable and prints it. Used for testing basic breakpoint functionality.
- `main_workflow_test.py` - Comprehensive test script that creates image and tensor data structures for testing the main workflow of the extension.
- `.vscode/launch.json` - Debug configuration for the Python scripts.

## Test Scripts

### `debug_test.py` (Basic Test)

The `debug_test.py` script:

1. Sets a variable `x` to "hello"
2. Prints the variable value (good place for a breakpoint on line 9)
3. Prints completion message

### `main_workflow_test.py` (Main Workflow Test)

The `main_workflow_test.py` script implements the main workflow test for the extension:

1. Creates sample image data using nested list structures (simulating numpy arrays)
2. Creates sample tensor data structures
3. Creates various types of image-like data (grayscale, float, RGB)
4. Provides multiple breakpoint locations for testing image variable visualization
5. Includes metadata about the created data structures

This script is designed to test the extension's core functionality: viewing and debugging image/tensor variables during Python debugging sessions.

## Running the Tests

### Manual Testing

To run the tests manually:

1. Open either `debug_test.py` or `main_workflow_test.py` in VS Code
2. Set breakpoints on the print statements (lines with image variable creation in main workflow test)
3. Start debugging with F5 or the debug panel using the appropriate launch configuration
4. The debugger should stop at the breakpoints
5. You can inspect variables in the debug console
6. Use the extension's image viewing commands to visualize image/tensor data

### Automated Testing

The automated tests are located in `tests/ui-test/`:

1. **Basic functionality test** (`python-debug-basic.test.ts`): Tests webview functionality and basic extension features
2. **Main workflow test** (`python-debug.test.ts`): Comprehensive test that:
   - Opens the main workflow Python script
   - Sets breakpoints on lines with image variables
   - Starts a debug session
   - Verifies the debugger stops at breakpoints
   - Tests extension image viewing commands during debugging
   - Validates webview functionality for image display
3. **Validation test** (`python-debug-verify.test.ts`): Verifies all test components are properly implemented

### Running Tests

```bash
# Run basic validation tests (no browser automation required)
yarn test:validate

# Run full UI tests (requires browser automation)
yarn ui-test:offscreen  # Recommended for CI environments
yarn ui-test           # For environments with display

# Compile tests only
yarn test:compile
```

## Extension Workflow Tested

The main workflow test validates the complete extension workflow:

1. **Python Script Preparation**: Creates a Python script with various image/tensor data structures
2. **Debugging Setup**: Opens the script in VS Code and sets breakpoints at strategic locations
3. **Debug Session**: Starts a Python debugging session and verifies breakpoints are hit
4. **Extension Integration**: Tests that the extension's image viewing commands work during debugging
5. **Webview Functionality**: Validates that the extension can open and display image content in webviews
6. **Multiple Data Types**: Tests the extension with different types of image-like data (RGB, grayscale, tensors, etc.)

This comprehensive test ensures that the extension's main use case - viewing images and tensors during Python debugging - works correctly.
