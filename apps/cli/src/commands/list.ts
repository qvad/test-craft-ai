/**
 * List Command - List test plans on server
 */

import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';

interface ListOptions {
  apiUrl: string;
  tags?: string[];
  search?: string;
  json?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const spinner = ora('Fetching test plans...').start();

  try {
    const params: Record<string, string | string[]> = {};
    if (options.tags) params.tags = options.tags;
    if (options.search) params.search = options.search;

    const response = await axios.get(`${options.apiUrl}/api/v1/plans`, { params });

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(response.data, null, 2));
      return;
    }

    const { items, total } = response.data;

    console.log(chalk.cyan(`\nTest Plans (${total} total)`));
    console.log(chalk.gray('─'.repeat(80)));

    if (items.length === 0) {
      console.log(chalk.yellow('No test plans found'));
      return;
    }

    for (const plan of items) {
      console.log(`${chalk.white(plan.name)} ${chalk.gray(`(${plan.id})`)}`);
      if (plan.description) {
        console.log(`  ${chalk.gray(plan.description)}`);
      }
      console.log(`  Tags: ${plan.tags.map((t: string) => chalk.cyan(t)).join(', ') || chalk.gray('none')}`);
      console.log(`  Updated: ${chalk.gray(new Date(plan.updatedAt).toLocaleString())}`);
      console.log('');
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to fetch test plans'));
    if (axios.isAxiosError(err)) {
      console.error(chalk.red(err.response?.data?.error || err.message));
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}
