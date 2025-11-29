'use strict';

// increase default test case timeout to 10 seconds for UI tests
const process = require('node:process');

const useJunitReporter = process.env.MOCHA_JUNIT === 'true';
const isCI = process.env.CI === 'true';

const config = {
  timeout: isCI ? 60000 : 10000, // Higher timeout for CI/headless environments
  reporter: useJunitReporter ? 'mocha-junit-reporter' : 'spec',
  slow: 5000,
  retries: isCI ? 2 : 1, // More retries in CI for flaky tests
  bail: false,
};

if (useJunitReporter) {
  config.reporterOptions = {
    mochaFile: './test-results/junit.xml',
    outputs: true,
    attachments: true,
    testCaseSwitchClassnameAndName: false,
    suiteTitleSeparatedBy: ' > ',
    rootSuiteTitle: 'UI Tests',
  };
}

module.exports = config;
