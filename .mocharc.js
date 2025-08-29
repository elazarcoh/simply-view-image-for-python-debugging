// increase default test case timeout to 10 seconds for UI tests
module.exports = {
  timeout: 10000,
  reporter: 'spec',
  slow: 5000,
  retries: 1,
  bail: false,
};
