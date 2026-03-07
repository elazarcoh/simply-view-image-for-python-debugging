import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/ts/**/*.test.ts'],
    reporters: process.env.MOCHA_JUNIT === 'true'
      ? [['junit', { outputFile: 'test-results/ts-unit.xml' }]]
      : ['verbose'],
  },
  resolve: {
    alias: {
      'vscode': path.resolve(__dirname, 'tests/unit/ts/__mocks__/vscode.ts'),
      'vscode-extensions-json-generator/utils': path.resolve(
        __dirname,
        'tests/unit/ts/__mocks__/vscode-extensions-json-generator-utils.ts',
      ),
    },
  },
});
