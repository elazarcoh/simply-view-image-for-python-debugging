import * as path from 'node:path';
import { glob } from 'glob';
import Mocha from 'mocha';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000, // 1 minute timeout for each test
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    // Use async/await pattern with glob
    (async () => {
      try {
        const files = await glob('**/**.test.js', { cwd: testsRoot });

        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        // Run the mocha test
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          }
          else {
            resolve();
          }
        });
      }
      catch (err) {
        console.error(err);
        reject(err);
      }
    })();
  });
}
