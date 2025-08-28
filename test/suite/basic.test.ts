import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('basic Extension Tests', () => {
  it('should have a valid package.json', () => {
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    assert.ok(fs.existsSync(packageJsonPath), 'package.json should exist');

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    assert.ok(packageJson.name, 'Package should have a name');
    assert.ok(packageJson.main, 'Package should have a main entry point');
    assert.ok(packageJson.contributes, 'Package should have contributions');
  });

  it('should have the main extension file', () => {
    const mainPath = path.resolve(__dirname, '../../../dist/extension.js');
    assert.ok(fs.existsSync(mainPath), 'Main extension file should exist after build');
  });

  it('should have test data files generated', () => {
    const testDataPath = path.resolve(process.cwd(), 'test/test-data/fixtures');
    assert.ok(fs.existsSync(testDataPath), 'Test data directory should exist');

    const expectedFiles = [
      'basic_test.py',
      'complex_test.py',
      'error_test.py',
      'performance_test.py',
      'tensor_test.py',
      'plot_test.py',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(testDataPath, file);
      assert.ok(fs.existsSync(filePath), `Test file ${file} should exist`);
    }
  });

  it('should have Python environment set up', () => {
    const pythonEnvPath = path.resolve(process.cwd(), 'test/test-env');
    assert.ok(fs.existsSync(pythonEnvPath), 'Python test environment should exist');

    const pythonBinary = path.join(pythonEnvPath, 'bin', 'python');
    assert.ok(fs.existsSync(pythonBinary), 'Python binary should exist in test environment');
  });
});

describe('configuration Tests', () => {
  it('should have valid configuration schema', () => {
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    assert.ok(packageJson.contributes.configuration, 'Should have configuration contributions');
    const config = packageJson.contributes.configuration;

    assert.ok(config.title, 'Configuration should have a title');
    assert.ok(config.properties, 'Configuration should have properties');
  });
});
