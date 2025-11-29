# Testing Issues and Solutions

## UI Test Issues

The VS Code Extension Tester framework encounters compatibility issues with Node.js 22.x and browser session management. This is a known issue with the Chrome/ChromeDriver integration.

### Issue Details

- **Error**: "session not created: probably user data directory is already in use"
- **Cause**: VS Code Extension Tester framework has browser session conflicts
- **Node.js Version**: v22.x (partially unsupported by ExTester, but works with proper configuration)

### Current Solutions

#### 1. Basic Validation Tests (Working)

```bash
yarn test:validate
```

These tests validate:

- Extension package configuration
- File structure and compilation
- Commands and activation events
- Basic environment setup

#### 2. Full UI Tests (Browser Automation)

```bash
yarn ui-test
```

##### **Recommended: Run UI Tests Offscreen (Headless) with xvfb**

For CI environments or headless systems, use:

```bash
yarn ui-test:offscreen
```

Or for better resolution and stability:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" yarn extest run-tests './out/tests/ui-test/*.test.js'
```

This uses `xvfb-run` to simulate a display so Chrome/VSCode can launch. This is the recommended way to run full UI tests in headless or CI environments.

**Prerequisites:**

- If you get `xvfb-run: command not found`, install it with:
  ```bash
  sudo apt install xvfb
  ```
- Ensure Python dependencies are installed:
  ```bash
  pip install -r tests/test-data/workspace/requirements.txt
  ```

**Environment Variables for CI:**

The tests automatically detect CI environments and adjust behavior:

- `CI=true` - Enables higher timeouts and more retries for stability
- `MOCHA_JUNIT=true` - Outputs test results in JUnit format for CI reporting

#### 3. Test Robustness Features

The test framework includes several robustness improvements for headless/CI environments:

1. **Workspace Loading Retry Logic**: The `openWorkspace()` function retries up to 3 times with configurable delays
2. **Image Watch Item Waiting**: Tests wait for the Image Watch section to be fully populated before interacting
3. **Mocha Configuration**: CI environments automatically use higher timeouts (60s) and more retries (2)
4. **Screenshot on Failure**: Failed tests capture screenshots for debugging

#### 4. Manual Testing

For UI features, manual testing in VS Code is recommended:

1. Install extension: `yarn install-extension`
2. Open Python debug session
3. Test image viewing functionality

### Recommendations

- Use `yarn test:validate` for basic CI/CD pipelines
- Use `yarn ui-test:offscreen` for full UI testing in CI with xvfb
- Set `CI=true` environment variable in CI pipelines for optimal test configuration

### Applied Fixes

- Fixed VS Code Extension Tester browser.js to use unique user data directories
- Created validation tests that don't require browser automation
- Added React dependency to resolve npm warnings
- Added retry logic for workspace loading
- Added waiting for Image Watch section items to be populated
- Improved mocha configuration with CI-aware timeouts and retries
- Enhanced GitHub Actions workflow with proper xvfb configuration
