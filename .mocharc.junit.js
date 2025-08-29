// Mocha configuration for JUnit XML output
module.exports = {
  timeout: 10000,
  reporter: 'mocha-junit-reporter',
  reporterOptions: {
    mochaFile: './test-results/junit.xml',
    outputs: true,
    attachments: true,
    testCaseSwitchClassnameAndName: false,
    suiteTitleSeparatedBy: ' > ',
    rootSuiteTitle: 'UI Tests',
  },
  slow: 5000,
  retries: 1,
  bail: false,
};
