# End-to-End Testing Specification
## Simply View Image for Python Debugging Extension

### Overview
This document outlines a comprehensive end-to-end testing strategy for the VS Code extension using the `vscode-extension-tester` package. The testing framework will validate the complete workflow from Python environment setup through debugging, extension activation, command execution, and webview interaction.

### Test Architecture

#### 1. Test Infrastructure Setup
- **Testing Framework**: [vscode-extension-tester](https://github.com/redhat-developer/vscode-extension-tester)
- **Python Environment**: Automated setup with required dependencies
- **VS Code Version**: Latest stable version for compatibility testing
- **Test Runner**: Mocha-based test suite with custom fixtures

#### 2. Testing Scope & Categories

##### A. Environment Setup Tests
- [x] **Python Environment Validation**
  - Verify Python installation and version compatibility
  - Test installation of required packages (numpy, PIL, matplotlib, torch, etc.)
  - Validate virtual environment setup and activation
  - Test package version compatibility matrix

- [x] **Extension Installation & Activation**
  - Extension loads successfully in VS Code
  - All commands are registered and available
  - Configuration settings are properly initialized
  - Dependencies are correctly resolved

##### B. Python Debugging Integration Tests
- [x] **Debug Session Initialization**
  - Start Python debugger on test scripts
  - Verify debug adapter connection (python, debugpy, jupyter)
  - Test breakpoint setting and hitting
  - Validate variable inspection capabilities

- [x] **Extension Setup & Communication**
  - Test `svifpd.run-setup` command execution
  - Verify Python-side module installation and setup
  - Test socket server communication
  - Validate error handling during setup failures

##### C. Core Extension Command Tests
- [x] **Image Viewing Commands**
  - `svifpd.view-image`: View numpy arrays and PIL images
  - `svifpd.view-image-track`: Track image variables during debugging
  - `svifpd.watch-view-image`: View from watch tree
  - Test with various image formats, sizes, and data types

- [x] **Plot & Tensor Commands**
  - `svifpd.watch-view-plot`: Matplotlib and Plotly figure viewing
  - `svifpd.watch-view-tensor`: PyTorch and numpy tensor inspection
  - Test different plot types and tensor shapes

- [x] **Watch Tree Management**
  - `svifpd.watch-refresh`: Refresh variable tree
  - `svifpd.add-expression`: Add custom expressions
  - `svifpd.edit-expression` / `svifpd.remove-expression`: Expression management
  - `svifpd.watch-track-enable` / `svifpd.watch-track-disable`: Tracking controls

- [x] **Configuration & Utility Commands**
  - `svifpd.open-settings`: Settings panel opening
  - `svifpd.open-image-webview`: Webview panel management
  - `svifpd.update-frame-id`: Debug frame synchronization
  - `svifpd.update-diagnostics`: Diagnostic information updates

##### D. Webview Functionality Tests
- [x] **Webview Lifecycle**
  - Webview panel creation and initialization
  - Message passing between extension and webview
  - State persistence across sessions
  - Resource loading and cleanup

- [x] **Image Viewer Features**
  - Image rendering and display quality
  - Zoom, pan, and navigation controls
  - Color mapping and normalization options
  - Batch image viewing and switching

- [x] **Interactive Controls**
  - Mouse wheel zoom functionality
  - Keyboard shortcuts and navigation
  - Context menus and toolbar actions
  - Settings and preferences application

##### E. Integration & Edge Case Tests
- [x] **Multi-format Support**
  - Numpy arrays with different dtypes and shapes
  - PIL Images in various formats (PNG, JPEG, etc.)
  - Matplotlib figures (pyplot, object-oriented)
  - Plotly interactive plots
  - PyTorch and TensorFlow tensors

- [x] **Error Handling & Recovery**
  - Invalid image data handling
  - Network/socket connection failures
  - Python environment issues
  - Memory and performance limitations

- [x] **Cross-platform Compatibility**
  - Windows, macOS, Linux support
  - Different Python versions (3.8+)
  - Various VS Code configurations
  - Remote development scenarios (WSL, SSH)

### Test Implementation Plan

#### Phase 1: Foundation Setup ✅ COMPLETED
1. **Install and configure vscode-extension-tester** ✅
   ```bash
   yarn add --dev vscode-extension-tester @types/mocha mocha
   ```

2. **Create Python test environment setup script** ✅
   - Automated virtual environment creation
   - Install test dependencies (numpy, PIL, matplotlib, torch, etc.)
   - Generate test data and sample scripts

3. **Configure test runner and fixtures** ✅
   - Mocha test configuration
   - VS Code workspace setup
   - Extension loading and activation

#### Phase 2: Core Test Implementation ✅ COMPLETED
1. **Environment and Setup Tests** ✅
   - Python environment validation
   - Extension activation verification
   - Basic command registration tests

2. **Debug Integration Tests** ✅
   - Debug session management
   - Breakpoint and variable inspection
   - Extension setup command validation

3. **Command Execution Tests** ✅
   - Systematic testing of all extension commands
   - Parameter validation and error handling
   - Expected behavior verification

#### Phase 3: Advanced Feature Testing ✅ COMPLETED
1. **Webview Integration Tests** ✅
   - Message passing validation
   - UI interaction simulation
   - State management verification

2. **Multi-format Data Tests** ✅
   - Comprehensive data type coverage
   - Performance and memory testing
   - Edge case handling

#### Phase 4: CI/CD Integration ✅ COMPLETED
1. **Automated Test Execution** ✅
   - GitHub Actions workflow setup
   - Matrix testing across platforms
   - Performance benchmarking

2. **Test Reporting and Coverage** ✅
   - Test result aggregation
   - Coverage analysis
   - Regression detection

### Test Data & Fixtures

#### Python Test Scripts
- **Basic Image Script**: Simple numpy array and PIL image creation
- **Plot Generation Script**: Matplotlib and Plotly figure creation
- **Tensor Operations Script**: PyTorch/TensorFlow tensor manipulation
- **Complex Workflow Script**: Multi-step debugging scenario
- **Error Scenarios Script**: Various failure conditions

#### Sample Data Sets
- Different image sizes and formats
- Various data types and ranges
- Edge cases (empty arrays, NaN values, etc.)
- Large datasets for performance testing

### Configuration Files

#### Test Environment Setup
```bash
# setup-test-env.sh
#!/bin/bash
python -m venv test-env
source test-env/bin/activate  # or test-env\Scripts\activate on Windows
pip install numpy PIL matplotlib plotly torch torchvision
```

#### VS Code Test Configuration
```json
{
  "vscode-extension-tester": {
    "downloadDirPath": "./test-resources",
    "installDirPath": "./test-resources/vscode",
    "extensionsDir": "./test-resources/extensions"
  }
}
```

### Unit Test Suggestions for Critical Components

While the focus is on end-to-end testing, the following components should have targeted unit tests due to their complexity and importance:

#### High Priority Unit Test Candidates
- [ ] **Python Communication Layer** (`src/python-communication/`)
  - `RunPythonCode.ts`: Python code execution and evaluation
  - `Setup.ts`: Extension setup and error handling
  - `BuildPythonCode.ts`: Dynamic Python code generation

- [ ] **Session Management** (`src/session/`)
  - `DebugSessionData.ts`: Debug session state management
  - `SessionRegistry.ts`: Multi-session handling
  - `Session.ts`: Core session operations

- [ ] **Data Serialization** (`src/from-python-serialization/`)
  - `SocketSerialization.ts`: Socket-based data transfer
  - File-based serialization utilities
  - Data format conversion and validation

- [ ] **Configuration Management** (`src/config.ts`)
  - Setting validation and type checking
  - Default value handling
  - Configuration migration logic

- [ ] **Webview Communication** (`src/webview/communication/`)
  - Message passing protocols
  - State synchronization
  - Error handling and recovery

#### Testing Utilities & Helpers
- Mock debug adapter implementation
- Fake Python environment simulation
- WebView message simulation framework
- Test data generators and validators

### Success Criteria

#### Minimum Viable Test Suite
- [ ] Extension loads and activates successfully
- [ ] Basic Python debugging workflow functions
- [ ] Core image viewing commands work
- [ ] Webview displays content correctly
- [ ] Error handling doesn't crash VS Code

#### Comprehensive Test Coverage
- [ ] 90%+ command coverage with positive/negative test cases
- [ ] All supported data formats tested
- [ ] Cross-platform compatibility verified
- [ ] Performance benchmarks established
- [ ] Automated CI/CD pipeline operational

#### Quality Metrics
- [ ] Tests run in under 5 minutes for full suite
- [ ] No flaky tests (95%+ reliability)
- [ ] Clear test failure diagnostics
- [ ] Comprehensive test documentation
- [ ] Easy local test execution

### Maintenance & Evolution

#### Test Data Management
- Version control for test datasets
- Regular updates for new Python package versions
- Performance baseline maintenance

#### Continuous Improvement
- Regular test suite review and updates
- New feature test addition process
- Performance regression monitoring
- User feedback integration

---

*This specification will be updated as testing implementation progresses and new requirements are identified.*