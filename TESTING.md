# Testing Issues and Solutions

## UI Test Issues

The VS Code Extension Tester framework encounters compatibility issues with Node.js 22.18.0 and browser session management. This is a known issue with the Chrome/ChromeDriver integration.

### Issue Details
- **Error**: "session not created: probably user data directory is already in use"
- **Cause**: VS Code Extension Tester framework has browser session conflicts
- **Node.js Version**: v22.18.0 (unsupported by ExTester)

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
```
yarn ui-test
```
Currently fails due to browser session issues. To fix:

##### **Recommended: Run UI Tests Offscreen (Headless) with xvfb**
If you are running in a CI environment or do not have a display, use:
```
yarn ui-test:offscreen
```
This uses `xvfb-run` to simulate a display so Chrome/VSCode can launch. This is the recommended way to run full UI tests in headless or CI environments.

- If you get `xvfb-run: command not found`, install it with:
  ```bash
  sudo apt install xvfb
  ```
- If Chrome/VSCode still fails to launch, ensure no lingering Chrome/VSCode processes and that your Node.js version is supported (see below).

1. **Use supported Node.js version**: 
   - Install Node.js 20.x (latest LTS)
   - Use nvm: `nvm use 20`

2. **Alternative browser setup**:
   - Ensure no Chrome/VS Code processes are running
   - Use headless mode in CI environments
   - Consider Docker containerization


#### 3. Manual Testing
For UI features, manual testing in VS Code is recommended:
1. Install extension: `yarn install-extension`
2. Open Python debug session
3. Test image viewing functionality

### Recommendations

- Use `yarn test:validate` for CI/CD pipelines
- Reserve full UI tests for specific environments
- Consider switching to Playwright or Puppeteer for more reliable browser automation

### Applied Fixes

- Fixed VS Code Extension Tester browser.js to use unique user data directories
- Created validation tests that don't require browser automation
- Added React dependency to resolve npm warnings