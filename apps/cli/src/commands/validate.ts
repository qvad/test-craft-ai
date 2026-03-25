/**
 * Validate Command - Validate HOCON test plans
 */

import * as fs from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';

interface ValidateOptions {
  strict?: boolean;
}

export async function validateCommand(file: string, options: ValidateOptions): Promise<void> {
  const spinner = ora('Validating test plan...').start();

  try {
    const content = await fs.readFile(file, 'utf-8');

    // Basic validation - check for required elements
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for testcraft root
    if (!content.includes('testcraft {')) {
      errors.push('Missing root "testcraft" element');
    }

    // Check for plan
    if (!content.includes('plan {')) {
      errors.push('Missing "plan" element');
    }

    // Check for name
    if (!content.match(/name\s*=\s*["'][^"']+["']/)) {
      errors.push('Missing plan name');
    }

    // Check for nodes
    if (!content.includes('nodes')) {
      errors.push('Missing "nodes" array');
    }

    // Check for version
    if (!content.match(/version\s*=\s*["'][^"']+["']/)) {
      warnings.push('Missing version, will default to 1.0');
    }

    // Check for common issues
    if (content.includes('${env.') && !content.includes('env =')) {
      warnings.push('Environment variable references found - ensure they are set at runtime');
    }

    // Check for unbalanced braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for unbalanced brackets
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
    }

    if (errors.length > 0) {
      spinner.fail(chalk.red('Validation failed'));
      console.log(chalk.red('\nErrors:'));
      for (const error of errors) {
        console.log(`  ${chalk.red('✗')} ${error}`);
      }
    } else {
      spinner.succeed(chalk.green('Validation passed'));
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      for (const warning of warnings) {
        console.log(`  ${chalk.yellow('⚠')} ${warning}`);
      }
    }

    // Extract and display plan info
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/);

    console.log(chalk.cyan('\nPlan Info:'));
    console.log(`  Name: ${chalk.white(nameMatch?.[1] || 'Unknown')}`);
    if (descMatch) {
      console.log(`  Description: ${chalk.gray(descMatch[1])}`);
    }

    // Count nodes
    const nodeMatches = content.match(/type\s*=\s*["'][^"']+["']/g);
    if (nodeMatches) {
      console.log(`  Nodes: ${chalk.white(nodeMatches.length)}`);
    }

    // Strict mode
    if (options.strict && warnings.length > 0) {
      process.exit(1);
    }

    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to read file'));
    console.error(err);
    process.exit(1);
  }
}
