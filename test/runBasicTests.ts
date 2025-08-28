/* eslint-disable no-console */
import * as path from 'node:path';
import process from 'node:process';
import { glob } from 'glob';
import Mocha from 'mocha';

async function runBasicTests() {
  console.log('Running basic tests without VS Code integration...');

  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000, // 10 second timeout for basic tests
  });

  const testsRoot = path.resolve(__dirname, '..');

  try {
    // Only run basic tests that don't require VS Code
    const basicTestFiles = await glob('**/basic.test.js', { cwd: testsRoot });

    if (basicTestFiles.length === 0) {
      console.log('No basic test files found');
      return;
    }

    // Add files to the test suite
    basicTestFiles.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

    // Run the mocha test
    return new Promise<void>((resolve, reject) => {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} basic tests failed.`));
        }
        else {
          console.log('All basic tests passed!');
          resolve();
        }
      });
    });
  }
  catch (err) {
    console.error('Error running basic tests:', err);
    throw err;
  }
}

if (require.main === module) {
  runBasicTests()
    .then(() => {
      console.log('Basic test suite completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Basic test suite failed:', err);
      process.exit(1);
    });
}
