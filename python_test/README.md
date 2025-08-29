# Python Debug Test

This directory contains a test for Python debugging functionality in VS Code.

## Files

- `debug_test.py` - A simple Python script that sets a variable and prints it. Used for testing breakpoint functionality.
- `.vscode/launch.json` - Debug configuration for the Python script.

## Test Script

The `debug_test.py` script:

1. Sets a variable `x` to "hello"
2. Prints the variable value (good place for a breakpoint on line 9)
3. Prints completion message

## Running the Test

To run the test manually:

1. Open `debug_test.py` in VS Code
2. Set a breakpoint on line 9 (the print statement)
3. Start debugging with F5 or the debug panel
4. The debugger should stop at the breakpoint
5. You can inspect the `x` variable in the debug console

## Automated Testing

The automated test in `tests/ui-test/python-debug.test.ts`:

1. Installs the Python extension if needed
2. Opens the Python script
3. Sets a breakpoint on line 9
4. Starts a debug session
5. Verifies the debugger stops at the breakpoint
6. Checks that variables are accessible in the debug session
