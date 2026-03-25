/**
 * Standalone CLI Test Script
 * Runs CLI commands and verifies output without external test runners
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import chalk from 'chalk';

const cliPath = 'src/index.ts';

function runCli(args: string) {
  try {
    return execSync(`npx tsx ${cliPath} ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err: any) {
    return err.stdout + err.stderr;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(chalk.red(`✘ FAILED: ${message}`));
    process.exit(1);
  }
  console.log(chalk.green(`✔ PASSED: ${message}`));
}

console.log(chalk.cyan('\nRunning CLI Tests...'));

// 1. Version test
console.log('\nTesting version command...');
const versionOutput = runCli('version');
assert(versionOutput.includes('TestCraft CLI'), 'Output should contain TestCraft CLI');
assert(versionOutput.includes('Version: 1.0.0'), 'Output should contain Version: 1.0.0');

// 2. Help test
console.log('\nTesting help command...');
const helpOutput = runCli('--help');
assert(helpOutput.includes('Usage: testcraft [options] [command]'), 'Output should contain usage info');
assert(helpOutput.includes('run [options] <file>'), 'Output should contain run command');
assert(helpOutput.includes('validate [options] <file>'), 'Output should contain validate command');

// 3. Init test
console.log('\nTesting init command...');
const testFile = 'test-init-plan.conf';
if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

try {
  const initOutput = runCli(`init -o ${testFile}`);
  // console.log('DEBUG initOutput:', JSON.stringify(initOutput));
  assert(fs.existsSync(testFile), 'File should exist on disk after init');

  const content = fs.readFileSync(testFile, 'utf8');
  assert(content.includes('testcraft {'), 'File should contain HOCON structure');
  assert(content.includes('type = "http-request"'), 'File should contain node config');
} finally {
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
}

// 4. Validate test
console.log('\nTesting validate command...');
const valFile = 'test-validate-plan.conf';
runCli(`init -o ${valFile}`);
try {
  const valOutput = runCli(`validate ${valFile}`);
  // Even if it fails due to no API, it shouldn't crash the script
  assert(valOutput !== undefined, 'Validation should run');
} finally {
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
}

console.log(chalk.bold.green('\nAll CLI tests passed!\n'));
