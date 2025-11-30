/* eslint-disable no-console */
import * as child_process from 'node:child_process';
import process from 'node:process';

async function runCommand(command: string, args: string[] = []): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = child_process.spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

async function main() {
  console.log('🧪 Starting comprehensive test suite...\n');

  // First, try to run the basic tests
  console.log('📦 Step 1: Running basic tests (no VS Code required)...');
  const basicResult = await runCommand('node', ['./out/test/runBasicTests.js']);

  if (basicResult.code === 0) {
    console.log('✅ Basic tests passed!\n');
  }
  else {
    console.error('❌ Basic tests failed!');
    console.error(basicResult.stdout);
    console.error(basicResult.stderr);
    process.exit(1);
  }

  // Now try integration tests
  console.log('🔧 Step 2: Attempting VS Code integration tests...');
  const integrationResult = await runCommand('node', ['./out/test/runTest.js']);

  if (integrationResult.code === 0) {
    console.log('✅ Integration tests passed!');
    console.log('\n🎉 All tests completed successfully!');
  }
  else if (integrationResult.code === 2) {
    // Network connectivity issue
    console.log('⚠️  Integration tests skipped due to network connectivity issues.');
    console.log('✅ Basic tests passed - core functionality verified.');
    console.log('\n📝 Note: Integration tests require network access to download VS Code.');
    console.log('   In CI environments, this may be blocked by firewall rules.');
    console.log('   Basic tests provide coverage for core functionality.');
  }
  else {
    console.error('❌ Integration tests failed!');
    console.error(integrationResult.stdout);
    console.error(integrationResult.stderr);
    console.log('\n✅ Basic tests passed - core functionality verified.');
    console.log('❌ Integration tests failed - VS Code-specific features may have issues.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
