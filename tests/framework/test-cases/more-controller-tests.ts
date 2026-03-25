/**
 * Additional Controller Test Cases
 * Runtime, Interleave, Random, Once-only, Module, Include controllers
 */

import type { TestCase } from '../test-runner';

export const moreControllerTests: TestCase[] = [
  // RUNTIME CONTROLLER
  {
    id: 'runtime-controller-basic',
    name: 'Runtime Controller - Basic',
    description: 'Test runtime controller configuration',
    nodeType: 'runtime-controller',
    category: 'controllers',
    config: {
      type: 'runtime-controller',
      runtimeSeconds: 60,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.runtimeSeconds === 60,
    },
    timeout: 5000,
    tags: ['controller', 'runtime'],
  },

  // INTERLEAVE CONTROLLER
  {
    id: 'interleave-controller-random',
    name: 'Interleave Controller - Random Style',
    description: 'Test interleave controller with random style',
    nodeType: 'interleave-controller',
    category: 'controllers',
    config: {
      type: 'interleave-controller',
      style: 'random',
      accrossThreads: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.style === 'random',
    },
    timeout: 5000,
    tags: ['controller', 'interleave'],
  },

  // RANDOM CONTROLLER
  {
    id: 'random-controller-basic',
    name: 'Random Controller - Basic',
    description: 'Test random controller',
    nodeType: 'random-controller',
    category: 'controllers',
    config: {
      type: 'random-controller',
      style: 'random',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => typeof result.output?.selectedChild === 'number',
    },
    timeout: 5000,
    tags: ['controller', 'random'],
  },

  // RANDOM ORDER CONTROLLER
  {
    id: 'random-order-controller-basic',
    name: 'Random Order Controller - Basic',
    description: 'Test random order controller',
    nodeType: 'random-order-controller',
    category: 'controllers',
    config: {
      type: 'random-order-controller',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.randomized === true,
    },
    timeout: 5000,
    tags: ['controller', 'random-order'],
  },

  // ONCE ONLY CONTROLLER
  {
    id: 'once-only-controller-basic',
    name: 'Once Only Controller - Basic',
    description: 'Test once only controller',
    nodeType: 'once-only-controller',
    category: 'controllers',
    config: {
      type: 'once-only-controller',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.executeOnce === true,
    },
    timeout: 5000,
    tags: ['controller', 'once-only'],
  },

  // MODULE CONTROLLER
  {
    id: 'module-controller-basic',
    name: 'Module Controller - Basic',
    description: 'Test module controller configuration',
    nodeType: 'module-controller',
    category: 'controllers',
    config: {
      type: 'module-controller',
      modulePath: 'Test Plan/Thread Group/Module',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['controller', 'module'],
  },

  // INCLUDE CONTROLLER
  {
    id: 'include-controller-basic',
    name: 'Include Controller - Basic',
    description: 'Test include controller configuration',
    nodeType: 'include-controller',
    category: 'controllers',
    config: {
      type: 'include-controller',
      includePath: '/path/to/fragment.jmx',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['controller', 'include'],
  },

  // PRECISE THROUGHPUT TIMER
  {
    id: 'precise-throughput-timer',
    name: 'Precise Throughput Timer - Basic',
    description: 'Test precise throughput timer configuration',
    nodeType: 'precise-throughput-timer',
    category: 'timers',
    config: {
      type: 'precise-throughput-timer',
      targetThroughput: 10,
      throughputPeriod: 1,
      duration: 60,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.targetThroughput === 10,
    },
    timeout: 5000,
    tags: ['timer', 'throughput', 'precise'],
  },
];

export default moreControllerTests;
