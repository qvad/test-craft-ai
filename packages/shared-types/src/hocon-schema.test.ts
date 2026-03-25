/**
 * Standalone HOCON Schema Test
 */

import { validateHocon, HoconTestPlan } from './hocon-schema.js';
import chalk from 'chalk';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(chalk.red(`✘ FAILED: ${message}`));
    process.exit(1);
  }
  console.log(chalk.green(`✔ PASSED: ${message}`));
}

function runTests() {
  console.log(chalk.cyan('\nRunning HOCON Schema Tests...'));

  // 1. Valid plan
  console.log('\nTesting valid plan...');
  const validPlan: any = {
    testcraft: {
      version: '1.0',
      plan: {
        name: 'Test Plan',
        nodes: [
          {
            name: 'Group 1',
            type: 'thread-group',
            config: { threads: 1 }
          }
        ]
      }
    }
  };

  try {
    const result = validateHocon(validPlan);
    assert(result.testcraft.plan.name === 'Test Plan', 'Valid plan should be accepted');
  } catch (err) {
    assert(false, `Valid plan was rejected: ${err}`);
  }

  // 2. Invalid plan - missing required field
  console.log('\nTesting plan with missing name...');
  const missingName: any = {
    testcraft: {
      version: '1.0',
      plan: {
        nodes: []
      }
    }
  };

  try {
    validateHocon(missingName);
    assert(false, 'Plan missing name should have been rejected');
  } catch (err) {
    assert(true, 'Plan missing name was correctly rejected');
  }

  // 3. Invalid plan - wrong connection type
  console.log('\nTesting plan with invalid connection type...');
  const invalidConn: any = {
    testcraft: {
      version: '1.0',
      plan: {
        name: 'Invalid Conn',
        connections: {
          db: { type: 'invalid-type' }
        },
        nodes: []
      }
    }
  };

  try {
    validateHocon(invalidConn);
    assert(false, 'Invalid connection type should have been rejected');
  } catch (err) {
    assert(true, 'Invalid connection type was correctly rejected');
  }

  // 4. Recursive nodes
  console.log('\nTesting nested nodes...');
  const nestedPlan: any = {
    testcraft: {
      version: '1.0',
      plan: {
        name: 'Nested',
        nodes: [
          {
            name: 'Parent',
            type: 'group',
            children: [
              { name: 'Child', type: 'sampler' }
            ]
          }
        ]
      }
    }
  };

  try {
    const result = validateHocon(nestedPlan);
    assert(result.testcraft.plan.nodes[0].children?.length === 1, 'Nested nodes should be accepted');
  } catch (err) {
    assert(false, `Nested nodes were rejected: ${err}`);
  }

  console.log(chalk.bold.green('\nAll HOCON Schema tests passed!\n'));
}

try {
  runTests();
} catch (err) {
  console.error(err);
  process.exit(1);
}
