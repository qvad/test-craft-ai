/**
 * Run Command - Execute test plans
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import WebSocket from 'ws';

interface RunOptions {
  environment?: string;
  var?: string[];
  output: string;
  format: string[];
  apiUrl: string;
  parallel?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  ci?: boolean;
}

interface ExecutionResult {
  executionId: string;
  status: 'success' | 'failed' | 'error';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: NodeResult[];
}

interface NodeResult {
  nodeId: string;
  nodeName: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  error?: string;
  assertions?: AssertionResult[];
}

interface AssertionResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runCommand(file: string, options: RunOptions): Promise<void> {
  const spinner = ora();

  try {
    // Read and parse the HOCON file
    spinner.start('Reading test plan...');
    const hoconContent = await fs.readFile(file, 'utf-8');
    spinner.succeed('Test plan loaded');

    // Parse variables
    const variables: Record<string, string> = {};
    if (options.var) {
      for (const v of options.var) {
        const eqIdx = v.indexOf('=');
        if (eqIdx > 0) {
          const key = v.substring(0, eqIdx);
          const value = v.substring(eqIdx + 1);
          variables[key] = value;
        }
      }
    }

    // Dry run mode
    if (options.dryRun) {
      spinner.start('Validating test plan...');
      const validation = await axios.post(`${options.apiUrl}/api/v1/plans/validate`, {
        hoconContent,
        environment: options.environment,
        variables,
      });
      spinner.succeed('Validation complete');

      console.log(chalk.cyan('\nExecution Plan (Dry Run):'));
      console.log(chalk.gray('─'.repeat(50)));
      printExecutionPlan(validation.data);
      return;
    }

    // Submit test plan for execution
    spinner.start('Submitting test plan...');
    const response = await axios.post(`${options.apiUrl}/api/v1/plans/execute`, {
      hoconContent,
      environment: options.environment,
      variables,
      parallel: options.parallel,
      reportFormats: options.format,
    });

    const { executionId } = response.data;
    spinner.succeed(`Execution started: ${chalk.cyan(executionId)}`);

    // Connect to WebSocket for real-time updates
    const result = await watchExecution(options.apiUrl, executionId, options.verbose);

    // Generate reports
    spinner.start('Generating reports...');
    await generateReports(options.apiUrl, executionId, options.output, options.format);
    spinner.succeed(`Reports saved to ${chalk.cyan(options.output)}`);

    // Print summary
    printSummary(result);

    // CI mode - exit with error code on failure
    if (options.ci && result.status !== 'success') {
      process.exit(1);
    }
  } catch (err) {
    spinner.fail(chalk.red('Execution failed'));
    if (axios.isAxiosError(err)) {
      console.error(chalk.red(err.response?.data?.error || err.message));
    } else {
      console.error(err);
    }
    if (options.ci) {
      process.exit(1);
    }
  }
}

async function watchExecution(
  apiUrl: string,
  executionId: string,
  verbose?: boolean
): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    const wsUrl = apiUrl.replace(/^http(s?):\/\//, 'ws$1://');
    const ws = new WebSocket(`${wsUrl}/api/v1/executions/${executionId}/stream`);

    let result: ExecutionResult;
    const nodeResults: Map<string, NodeResult> = new Map();

    ws.on('message', (data) => {
      let event;
      try {
        event = JSON.parse(data.toString());
      } catch {
        return; // Skip malformed messages
      }

      switch (event.type) {
        case 'execution:started':
          console.log(chalk.cyan('\nExecution started'));
          console.log(chalk.gray('─'.repeat(50)));
          break;

        case 'node:started':
          if (verbose) {
            console.log(chalk.yellow(`▶ ${event.nodeName}`));
          }
          break;

        case 'node:completed':
          const status = event.status === 'passed'
            ? chalk.green('✓')
            : event.status === 'failed'
            ? chalk.red('✗')
            : chalk.yellow('○');

          console.log(`${status} ${event.nodeName} ${chalk.gray(`(${event.duration}ms)`)}`);

          if (event.status === 'failed' && event.error) {
            console.log(chalk.red(`  └─ ${event.error}`));
          }

          nodeResults.set(event.nodeId, {
            nodeId: event.nodeId,
            nodeName: event.nodeName,
            status: event.status,
            duration: event.duration,
            error: event.error,
            assertions: event.assertions,
          });
          break;

        case 'execution:completed':
          result = {
            executionId,
            status: event.status,
            totalTests: event.totalTests,
            passed: event.passed,
            failed: event.failed,
            skipped: event.skipped,
            duration: event.duration,
            results: Array.from(nodeResults.values()),
          };
          ws.close();
          break;

        case 'execution:error':
          reject(new Error(event.error));
          ws.close();
          break;
      }
    });

    ws.on('close', () => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('WebSocket closed before execution completed'));
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });

    // Fallback: poll for status if WebSocket fails
    setTimeout(async () => {
      if (!result) {
        try {
          const response = await axios.get(`${apiUrl}/api/v1/executions/${executionId}`);
          if (response.data.status === 'completed' || response.data.status === 'failed') {
            result = response.data;
            ws.close();
            resolve(result);
          }
        } catch {
          // Continue waiting
        }
      }
    }, 5000);
  });
}

async function generateReports(
  apiUrl: string,
  executionId: string,
  outputDir: string,
  formats: string[]
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  for (const format of formats) {
    const response = await axios.get(
      `${apiUrl}/api/v1/executions/${executionId}/report`,
      {
        params: { format },
        responseType: format === 'html' ? 'text' : 'json',
      }
    );

    const ext = format === 'junit' ? 'xml' : format;
    const filePath = path.join(outputDir, `test-report.${ext}`);

    if (format === 'html' || format === 'junit') {
      await fs.writeFile(filePath, response.data, 'utf-8');
    } else {
      await fs.writeFile(filePath, JSON.stringify(response.data, null, 2), 'utf-8');
    }
  }
}

function printExecutionPlan(plan: any): void {
  console.log(`Name: ${chalk.cyan(plan.name)}`);
  console.log(`Environment: ${chalk.cyan(plan.environment || 'default')}`);
  console.log(`Total Nodes: ${chalk.cyan(plan.nodeCount)}`);
  console.log(`Estimated Duration: ${chalk.cyan(plan.estimatedDuration)}`);

  if (plan.nodes) {
    console.log(chalk.gray('\nNodes to execute:'));
    for (const node of plan.nodes) {
      console.log(`  ${chalk.yellow(node.type)} ${node.name}`);
    }
  }

  if (plan.warnings && plan.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    for (const warning of plan.warnings) {
      console.log(`  ⚠ ${warning}`);
    }
  }
}

function printSummary(result: ExecutionResult): void {
  console.log(chalk.gray('\n' + '─'.repeat(50)));
  console.log(chalk.cyan('Execution Summary'));
  console.log(chalk.gray('─'.repeat(50)));

  const statusColor = result.status === 'success' ? chalk.green : chalk.red;
  console.log(`Status: ${statusColor(result.status.toUpperCase())}`);
  console.log(`Duration: ${chalk.cyan(`${result.duration}ms`)}`);
  console.log(`Total Tests: ${chalk.cyan(result.totalTests)}`);
  console.log(`  ${chalk.green('✓ Passed:')} ${result.passed}`);
  console.log(`  ${chalk.red('✗ Failed:')} ${result.failed}`);
  console.log(`  ${chalk.yellow('○ Skipped:')} ${result.skipped}`);

  if (result.failed > 0) {
    console.log(chalk.red('\nFailed Tests:'));
    for (const node of result.results.filter((n) => n.status === 'failed')) {
      console.log(`  ${chalk.red('✗')} ${node.nodeName}`);
      if (node.error) {
        console.log(`    ${chalk.gray(node.error)}`);
      }
    }
  }
}
