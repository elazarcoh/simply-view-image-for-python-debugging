#!/usr/bin/env node
/* eslint-disable no-console, node/prefer-global/process */
/**
 * Runner for TypeScript/JavaScript unit tests in tests/unit/ts/.
 *
 * Finds all test_*.js files, executes each with `node`, captures output,
 * and optionally generates JUnit XML for CI reporting.
 *
 * Usage:
 *   node tests/unit/ts/run-all.mjs [--junitxml <path>]
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findTestFiles() {
  return readdirSync(__dirname)
    .filter(f => f.startsWith('test_') && f.endsWith('.js'))
    .sort();
}

function parseResults(output) {
  const match = output.match(/Results:\s*(\d+)\s*passed,\s*(\d+)\s*failed/);
  if (match) {
    return { passed: Number.parseInt(match[1], 10), failed: Number.parseInt(match[2], 10) };
  }
  return null;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateJunitXml(results) {
  let totalTests = 0;
  let totalFailures = 0;
  const suites = [];

  for (const r of results) {
    const tests = r.stats ? r.stats.passed + r.stats.failed : (r.exitCode === 0 ? 1 : 1);
    const failures = r.stats ? r.stats.failed : (r.exitCode === 0 ? 0 : 1);
    totalTests += tests;
    totalFailures += failures;

    let testCases = '';
    if (r.stats) {
      // Parse individual test lines from output
      const lines = r.output.split('\n');
      for (const line of lines) {
        const passMatch = line.match(/^\s*✅ (.+)$/);
        const failMatch = line.match(/^\s*❌ ([^:]+)(?:: (.*))?$/);
        if (passMatch) {
          testCases += `      <testcase name="${escapeXml(passMatch[1])}" classname="${escapeXml(r.file)}" />\n`;
        }
        else if (failMatch) {
          testCases += `      <testcase name="${escapeXml(failMatch[1])}" classname="${escapeXml(r.file)}">\n`;
          testCases += `        <failure message="${escapeXml(failMatch[2] || 'Test failed')}">${escapeXml(r.output)}</failure>\n`;
          testCases += `      </testcase>\n`;
        }
      }
    }
    if (!testCases) {
      // Fallback: single test case for the whole file
      testCases = `      <testcase name="${escapeXml(r.file)}" classname="${escapeXml(r.file)}"`;
      if (r.exitCode !== 0) {
        testCases += `>\n        <failure message="Process exited with code ${r.exitCode}">${escapeXml(r.output)}</failure>\n      </testcase>\n`;
      }
      else {
        testCases += ` />\n`;
      }
    }

    suites.push(
      `    <testsuite name="${escapeXml(r.file)}" tests="${tests}" failures="${failures}" errors="0">\n${testCases}    </testsuite>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${totalTests}" failures="${totalFailures}" errors="0">\n${suites.join('\n')}\n</testsuites>\n`;
}

// --- Main ---
const args = process.argv.slice(2);
let junitPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--junitxml' && args[i + 1]) {
    junitPath = args[i + 1];
    i++;
  }
}

const testFiles = findTestFiles();
if (testFiles.length === 0) {
  console.log('No test files found (tests/unit/ts/test_*.js)');
  process.exit(0);
}

console.log(`Found ${testFiles.length} test file(s):\n`);

const results = [];
let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
  const filePath = join(__dirname, file);
  console.log(`── ${file} ──`);

  let output = '';
  let exitCode = 0;
  try {
    output = execFileSync('node', [filePath], {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    console.log(output);
  }
  catch (err) {
    exitCode = err.status ?? 1;
    output = (err.stdout || '') + (err.stderr || '');
    console.log(output);
  }

  const stats = parseResults(output);
  if (stats) {
    totalPassed += stats.passed;
    totalFailed += stats.failed;
  }
  else if (exitCode !== 0) {
    totalFailed++;
  }
  else {
    totalPassed++;
  }

  results.push({ file, output, exitCode, stats });
}

console.log(`\n${'═'.repeat(40)}`);
console.log(`Total: ${totalPassed} passed, ${totalFailed} failed (${testFiles.length} files)`);

if (junitPath) {
  const xml = generateJunitXml(results);
  writeFileSync(junitPath, xml, 'utf-8');
  console.log(`JUnit XML written to ${junitPath}`);
}

process.exit(totalFailed > 0 ? 1 : 0);
