/**
 * Thread Group and Root Test Cases
 */

import type { TestCase } from '../test-runner';

export const threadGroupTests: TestCase[] = [
  // ROOT
  {
    id: 'root-basic',
    name: 'Root - Basic Test Plan',
    description: 'Test root test plan node',
    nodeType: 'root',
    category: 'thread-groups',
    config: {
      type: 'root',
      name: 'Test Plan',
      comments: 'Test plan description',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Test Plan', 'isValid'],
    },
    timeout: 5000,
    tags: ['root', 'basic'],
  },

  // THREAD GROUPS
  {
    id: 'thread-group-basic',
    name: 'Thread Group - Basic Configuration',
    description: 'Test basic thread group configuration',
    nodeType: 'thread-group',
    category: 'thread-groups',
    config: {
      type: 'thread-group',
      numThreads: 10,
      rampUp: 5,
      loops: 3,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.numThreads === 10 &&
        result.output?.rampUp === 5 &&
        result.output?.loops === 3,
    },
    timeout: 5000,
    tags: ['thread-group', 'basic'],
  },
  {
    id: 'thread-group-forever',
    name: 'Thread Group - Forever Loop',
    description: 'Test thread group with infinite loop',
    nodeType: 'thread-group',
    category: 'thread-groups',
    config: {
      type: 'thread-group',
      numThreads: 5,
      rampUp: 0,
      loops: 'forever',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.loops === -1,
    },
    timeout: 5000,
    tags: ['thread-group', 'infinite'],
  },
  {
    id: 'setup-thread-group',
    name: 'Setup Thread Group - Basic',
    description: 'Test setup thread group',
    nodeType: 'setup-thread-group',
    category: 'thread-groups',
    config: {
      type: 'setup-thread-group',
      numThreads: 1,
      rampUp: 0,
      loops: 1,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.type === 'setup',
    },
    timeout: 5000,
    tags: ['thread-group', 'setup'],
  },
  {
    id: 'teardown-thread-group',
    name: 'Teardown Thread Group - Basic',
    description: 'Test teardown thread group',
    nodeType: 'teardown-thread-group',
    category: 'thread-groups',
    config: {
      type: 'teardown-thread-group',
      numThreads: 1,
      rampUp: 0,
      loops: 1,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.type === 'teardown',
    },
    timeout: 5000,
    tags: ['thread-group', 'teardown'],
  },
];

export default threadGroupTests;
