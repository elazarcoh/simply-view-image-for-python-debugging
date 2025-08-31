'use strict';

// increase default test case timeout to 10 seconds for UI tests
const process = require('node:process');

const useJunitReporter = process.env.MOCHA_JUNIT === 'true';

const config = {
  timeout: 10000,
  reporter: useJunitReporter ? 'mocha-junit-reporter' : 'spec',
  slow: 5000,
  retries: 1,
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
