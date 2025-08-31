# DebugTestHelper Documentation

## Overview
The `DebugTestHelper` class is a comprehensive utility for testing Python debugging functionality with the Simply View Image for Python Debugging extension. It provides a fluent API that encapsulates common debugging test patterns.

## Key Features

### 1. Debug Session Management
- `openDebugPanel()`: Opens the VS Code debug panel
- `selectLaunchConfiguration(pattern)`: Selects a debug configuration
- `startDebugging()`: Starts a debug session
- `waitForBreakpoint()`: Waits for breakpoints to be hit
- `stopDebugging()`: Stops the debug session

### 2. File Operations
- `openFile(filePath)`: Opens a file in the workspace
- `openEditor(fileName)`: Opens a specific editor
- `addBreakpoint(lineNumber)`: Adds breakpoints (placeholder implementation)

### 3. Image Watch Section Operations
- `expandImageWatchSection()`: Expands the Image Watch panel
- `refreshImageWatch()`: Refreshes the Image Watch content
- `findAndExpandTreeItem(itemName)`: Finds and expands tree items

### 4. Variable Interactions
- `performVariableAction(options)`: Performs actions on variables (e.g., "View Image")
- Supports retry logic with setup refresh for reliability
- Handles variable discovery with automatic retries

### 5. Expression Management
- `addExpression(options)`: Adds new expressions to watch
- `editExpression(oldExpr, newExpr)`: Edits existing expressions
- Integrates with VS Code command palette

### 6. Webview Operations
- `waitForImageWebview()`: Waits for Image View webview to open
- `findImageWebview()`: Finds and switches to the webview
- `interactWithWebview()`: Placeholder for webview interactions

### 7. Screenshot Capabilities
- `takeScreenshot(options)`: Takes screenshots of webview, editor, or fullscreen
- Supports different screenshot types for comprehensive test documentation

### 8. Utility Methods
- `wait(ms)`: Custom wait functionality
- `log(message)`: Consistent logging
- `executeCommand(command)`: Execute VS Code commands
- `cleanup()`: Clean up resources and state

## Usage Patterns

### Basic Variable Viewing Test
```typescript
await debugHelper.openFile(fileInWorkspace('debug_test.py'));
await debugHelper.openEditor('debug_test.py');
await debugHelper.openDebugPanel();
await debugHelper.selectLaunchConfiguration('Python: Current File');
await debugHelper.startDebugging();
await debugHelper.waitForBreakpoint();
await debugHelper.expandImageWatchSection();
await debugHelper.performVariableAction({
  variableName: 'x',
  actionLabel: 'View Image',
  retrySetup: true,
  setupRetries: 5,
});
await debugHelper.waitForImageWebview();
await debugHelper.takeScreenshot({ name: 'test-result', elementType: 'webview' });
await debugHelper.stopDebugging();
```

### Expression Testing
```typescript
await debugHelper.addExpression({ expression: 'x.shape' });
await debugHelper.addExpression({ expression: 'x * 255' });
await debugHelper.refreshImageWatch();
await debugHelper.performVariableAction({
  variableName: 'x * 255',
  actionLabel: 'View Image',
  retrySetup: true,
  setupRetries: 3,
});
```

## Design Principles

### 1. Error Resilience
- Methods include retry logic for flaky UI interactions
- Graceful fallbacks for missing elements
- Comprehensive error messages for debugging

### 2. Configurability
- Timeout and retry settings can be customized
- Sleep durations are configurable
- Flexible screenshot options

### 3. Fluent API Design
- Methods return `this` to enable chaining (when synchronous)
- Consistent naming conventions
- Clear separation of concerns

### 4. Singleton Pattern
- `getInstance()` provides singleton access
- `reset()` allows clean state between tests
- Automatic cleanup functionality

## Additional Features That Could Be Added

### 1. Enhanced Breakpoint Management
- `addBreakpointAt(file, line)`: Add breakpoints at specific locations
- `removeBreakpoint(file, line)`: Remove specific breakpoints
- `listBreakpoints()`: Get all active breakpoints
- `enableBreakpoint(id)` / `disableBreakpoint(id)`: Toggle breakpoints

### 2. Advanced Webview Interactions
- `clickWebviewElement(selector)`: Click specific webview elements
- `setWebviewValue(element, value)`: Set values in webview controls
- `getWebviewText(selector)`: Extract text from webview
- `waitForWebviewElement(selector)`: Wait for specific elements

### 3. Variable Inspection
- `getVariableValue(name)`: Get variable values
- `getVariableType(name)`: Get variable types
- `expandVariable(name)`: Expand complex variables
- `compareVariables(name1, name2)`: Compare variables

### 4. Multi-Session Support
- `createDebugSession(config)`: Create multiple debug sessions
- `switchDebugSession(id)`: Switch between sessions
- `getActiveDebugSession()`: Get current session

### 5. Enhanced Expression Features
- `validateExpression(expr)`: Validate expressions before adding
- `getExpressionResult(expr)`: Get evaluation results
- `removeExpression(expr)`: Remove specific expressions
- `clearAllExpressions()`: Clear all expressions

### 6. Test Data Generation
- `generateTestArray(shape, dtype)`: Generate test arrays
- `createTestImage(width, height, channels)`: Create test images
- `loadTestData(file)`: Load test data files

### 7. Performance Monitoring
- `startPerformanceMonitoring()`: Track performance metrics
- `getExecutionTime(operation)`: Measure operation times
- `getMemoryUsage()`: Monitor memory consumption

### 8. Integration Testing
- `simulateUserWorkflow(steps)`: Simulate complex user interactions
- `runParallelTests(tests)`: Execute parallel test scenarios
- `validateExtensionState()`: Verify extension state consistency

## Error Handling Patterns

The helper class implements several error handling patterns:

1. **Retry with Exponential Backoff**: For flaky UI operations
2. **Graceful Degradation**: Fallback to alternative approaches
3. **Comprehensive Logging**: Detailed error context for debugging
4. **Resource Cleanup**: Automatic cleanup on failures
5. **State Validation**: Verify expected states before operations

## Best Practices for Usage

1. **Always call cleanup()**: Ensure proper resource management
2. **Use appropriate timeouts**: Set realistic timeouts for operations
3. **Handle expected failures**: Wrap operations that might fail in try-catch
4. **Take screenshots on failures**: Capture state for debugging
5. **Use descriptive test names**: Make test purposes clear
6. **Reset helper between tests**: Use `DebugTestHelper.reset()` for clean state