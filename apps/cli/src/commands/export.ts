/**
 * Export Command - Export test plans to HOCON files
 */

import * as fs from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';

interface ExportOptions {
  apiUrl: string;
}

export async function exportCommand(id: string, file: string, options: ExportOptions): Promise<void> {
  const spinner = ora('Exporting test plan...').start();

  try {
    const response = await axios.get(`${options.apiUrl}/api/v1/plans/${id}/export`);

    await fs.writeFile(file, response.data.hoconContent, 'utf-8');

    spinner.succeed(chalk.green(`Exported to ${file}`));

    console.log(chalk.cyan('\nPlan Details:'));
    console.log(`  ID: ${chalk.white(id)}`);
    console.log(`  Name: ${chalk.white(response.data.name)}`);
    console.log(`  Version: ${chalk.white(response.data.version)}`);
  } catch (err) {
    spinner.fail(chalk.red('Export failed'));
    if (axios.isAxiosError(err)) {
      console.error(chalk.red(err.response?.data?.error || err.message));
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}
