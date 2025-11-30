/* eslint-disable no-console */
import * as path from 'node:path';
import process from 'node:process';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    console.log('Attempting to run VS Code integration tests...');
    console.log('Extension dev path:', extensionDevelopmentPath);
    console.log('Extension test path:', extensionTestsPath);

    // Try different approaches based on environment
    const testOptions: any = {
      extensionDevelopmentPath,
      extensionTestsPath,
    };

    // If we're in a CI environment with network issues, try different strategies
    if (process.env.CI) {
      console.log('Detected CI environment, trying stable version...');
      testOptions.version = 'stable';
      testOptions.timeout = 300000; // 5 minute timeout
    }

    // Download VS Code, unzip it and run the integration test
    await runTests(testOptions);
    console.log('Integration tests completed successfully');
  }
  catch (err) {
    console.error('Failed to run tests');
    console.error('Error details:', err);

    if (err instanceof Error) {
      console.error('Stack trace:', err.stack);

      // Check if it's a network connectivity issue
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        console.error('\n=== NETWORK CONNECTIVITY ISSUE DETECTED ===');
        console.error('Cannot download VS Code due to network restrictions.');
        console.error('This is a common issue in CI environments.');
        console.error('Consider running basic tests instead: yarn test:basic');
        console.error('===========================================\n');

        // Exit with a different code to distinguish network issues
        process.exit(2);
      }
    }

    process.exit(1);
  }
}

main();
