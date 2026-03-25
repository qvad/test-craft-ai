/**
 * Import Command - Import HOCON test plans to server
 */

import * as fs from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';

interface ImportOptions {
  apiUrl: string;
  name?: string;
}

export async function importCommand(file: string, options: ImportOptions): Promise<void> {
  const spinner = ora('Importing test plan...').start();

  try {
    const content = await fs.readFile(file, 'utf-8');

    const response = await axios.post(`${options.apiUrl}/api/v1/plans/import`, {
      hoconContent: content,
      nameOverride: options.name,
    });

    spinner.succeed(chalk.green('Test plan imported'));

    console.log(chalk.cyan('\nImported Plan:'));
    console.log(`  ID: ${chalk.white(response.data.id)}`);
    console.log(`  Name: ${chalk.white(response.data.name)}`);
    console.log(`  Version: ${chalk.white(response.data.version)}`);

    console.log(chalk.gray('\nTo run this plan:'));
    console.log(`  testcraft run ${file}`);
  } catch (err) {
    spinner.fail(chalk.red('Import failed'));
    if (axios.isAxiosError(err)) {
      console.error(chalk.red(err.response?.data?.error || err.message));
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}
