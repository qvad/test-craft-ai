#!/usr/bin/env node

/**
 * TestCraft CLI
 *
 * Command-line tool for running TestCraft test plans.
 * Designed for CI/CD integration (Jenkins, GitHub Actions, etc.)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from 'dotenv';
import { runCommand } from './commands/run.js';
import { validateCommand } from './commands/validate.js';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';
import { listCommand } from './commands/list.js';

// Load environment variables
config();

const program = new Command();

program
  .name('testcraft')
  .description('TestCraft AI - Visual Test Orchestration Platform CLI')
  .version('1.0.0');

// Run test plan
program
  .command('run <file>')
  .description('Run a test plan from HOCON file')
  .option('-e, --environment <env>', 'Environment to use (dev, staging, prod)')
  .option('-v, --var <vars...>', 'Variables in format KEY=VALUE')
  .option('-o, --output <dir>', 'Output directory for reports', './reports')
  .option('-f, --format <formats...>', 'Report formats (json, junit, html, allure)', ['json', 'junit'])
  .option('--api-url <url>', 'TestCraft API URL', process.env.TESTCRAFT_API_URL || 'http://localhost:3000')
  .option('--parallel', 'Run tests in parallel where possible')
  .option('--dry-run', 'Validate and show execution plan without running')
  .option('--verbose', 'Enable verbose output')
  .option('--ci', 'CI mode - exit with non-zero code on failure')
  .action(runCommand);

// Validate test plan
program
  .command('validate <file>')
  .description('Validate a HOCON test plan file')
  .option('--strict', 'Fail on warnings')
  .action(validateCommand);

// Export test plan
program
  .command('export <id> <file>')
  .description('Export test plan from server to HOCON file')
  .option('--api-url <url>', 'TestCraft API URL', process.env.TESTCRAFT_API_URL || 'http://localhost:3000')
  .action(exportCommand);

// Import test plan
program
  .command('import <file>')
  .description('Import HOCON test plan to server')
  .option('--api-url <url>', 'TestCraft API URL', process.env.TESTCRAFT_API_URL || 'http://localhost:3000')
  .option('--name <name>', 'Override test plan name')
  .action(importCommand);

// List test plans
program
  .command('list')
  .description('List test plans on server')
  .option('--api-url <url>', 'TestCraft API URL', process.env.TESTCRAFT_API_URL || 'http://localhost:3000')
  .option('--tags <tags...>', 'Filter by tags')
  .option('--search <query>', 'Search by name or description')
  .option('--json', 'Output as JSON')
  .action(listCommand);

// Init command - create sample test plan
program
  .command('init')
  .description('Create a sample HOCON test plan')
  .option('-t, --template <template>', 'Template to use (http, database, load, ai)', 'http')
  .option('-o, --output <file>', 'Output file', 'test-plan.conf')
  .action(async (options) => {
    const spinner = ora('Creating test plan...').start();

    const templates: Record<string, string> = {
      http: `# HTTP API Test Plan
testcraft {
  version = "1.0"

  plan {
    name = "My API Test"
    description = "API test plan created with TestCraft CLI"
    tags = ["api", "smoke"]

    settings {
      defaultTimeout = "30s"
    }

    variables {
      baseUrl {
        type = string
        default = "http://localhost:3000"
        env = "API_BASE_URL"
      }
    }

    nodes = [
      {
        name = "API Tests"
        type = "thread-group"
        config {
          threads = 1
          loops = 1
        }
        children = [
          {
            name = "Health Check"
            type = "http-request"
            config {
              method = "GET"
              path = "/health"
            }
            children = [
              {
                name = "Verify Status 200"
                type = "response-assertion"
                config {
                  testField = "response-code"
                  pattern = "200"
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
`,
      database: `# Database Test Plan
testcraft {
  version = "1.0"

  plan {
    name = "Database Test"
    description = "Database integration tests"

    connections {
      db {
        type = jdbc
        url = "jdbc:postgresql://\${env.DB_HOST}:5432/testdb"
        username = \${env.DB_USER}
        password = \${env.DB_PASSWORD}
      }
    }

    nodes = [
      {
        name = "DB Tests"
        type = "thread-group"
        config { threads = 1, loops = 1 }
        children = [
          {
            name = "Query Test"
            type = "jdbc-request"
            config {
              connection = "db"
              queryType = "select"
              query = "SELECT COUNT(*) FROM users"
            }
          }
        ]
      }
    ]
  }
}
`,
      load: `# Load Test Plan
testcraft {
  version = "1.0"

  plan {
    name = "Load Test"
    description = "Performance and load testing"
    tags = ["performance", "load"]

    settings {
      parallel = true
      reporting {
        format = ["json", "html"]
        outputDir = "./reports"
      }
    }

    nodes = [
      {
        name = "Load Test"
        type = "thread-group"
        config {
          threads = 50
          rampUp = "30s"
          duration = "300s"
        }
        children = [
          {
            name = "API Request"
            type = "http-request"
            config {
              method = "GET"
              path = "/api/products"
            }
            children = [
              {
                name = "Response Time < 2s"
                type = "duration-assertion"
                config { maxDuration = 2000 }
              }
            ]
          }
        ]
      }
    ]
  }
}
`,
      ai: `# AI-Powered Test Plan
testcraft {
  version = "1.0"

  plan {
    name = "AI Test Generation"
    description = "AI-powered test generation and validation"

    settings {
      ai {
        enabled = true
        useRAG = true
      }
    }

    nodes = [
      {
        name = "AI Tests"
        type = "thread-group"
        config { threads = 1, loops = 1 }
        children = [
          {
            name = "Generate Test Data"
            type = "ai-data-generator"
            ai {
              intent = "Generate 10 realistic user profiles"
              useRAG = true
            }
            config {
              count = 10
              outputVariable = "users"
            }
          }
          {
            name = "AI Validation"
            type = "ai-assertion"
            ai {
              intent = "Verify the generated users have valid email formats and realistic names"
            }
          }
        ]
      }
    ]
  }
}
`
    };

    try {
      const template = templates[options.template] || templates.http;
      await fs.writeFile(options.output, template, 'utf-8');
      spinner.succeed(chalk.green(`Created ${options.output}`));
      console.log(chalk.cyan(`\nNext steps:`));
      console.log(`  1. Edit ${options.output} to customize your test`);
      console.log(`  2. Run: ${chalk.yellow(`testcraft validate ${options.output}`)}`);
      console.log(`  3. Run: ${chalk.yellow(`testcraft run ${options.output}`)}`);
    } catch (err) {
      spinner.fail(chalk.red('Failed to create test plan'));
      console.error(err);
      process.exit(1);
    }
  });

// Version info
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(chalk.cyan('TestCraft CLI'));
    console.log(`Version: ${chalk.yellow('1.0.0')}`);
    console.log(`Node.js: ${chalk.yellow(process.version)}`);
    console.log(`Platform: ${chalk.yellow(process.platform)}`);
  });

program.parse();
