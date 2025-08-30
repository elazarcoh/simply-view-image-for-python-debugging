#!/usr/bin/env node

/**
 * Basic validation tests for Simply View Image for Python Debugging extension
 * Runs tests that don't require browser automation
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* eslint-disable no-console */
console.log('Running basic validation tests for Simply View Image extension...');

// Test configuration
const testDir = path.join(__dirname, 'out', 'tests', 'ui-test');
const testPattern = '**/python-debug-verify.test.js';

// Mocha configuration
const mochaArgs = [
  testDir,
  '--grep',
  'python Debugging Components',
  '--timeout',
  '30000',
  '--reporter',
  'spec',
];

console.log(`Running validation tests from: ${testDir}`);
console.log(`Test pattern: ${testPattern}`);

// Run tests
const mocha = spawn('npx', ['mocha', ...mochaArgs], {
  stdio: 'inherit',
  cwd: __dirname,
});

mocha.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Basic validation tests passed successfully!');
    console.log('Extension package structure and configuration are valid.');
  }
  else {
    console.log('\n❌ Basic validation tests failed.');
    console.log('Please check the extension configuration and build output.');
  }
  process.exit(code);
});

mocha.on('error', (err) => {
  console.error('Failed to run validation tests:', err);
  process.exit(1);
});
