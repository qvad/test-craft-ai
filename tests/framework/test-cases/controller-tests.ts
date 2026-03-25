/**
 * Controller and Timer Node Test Cases
 * Tests for Loop, While, ForEach, If, Switch, Timers, etc.
 */

import type { TestCase } from '../test-runner';

export const controllerTests: TestCase[] = [
  // ============================================================================
  // LOOP CONTROLLER TESTS
  // ============================================================================
  {
    id: 'loop-fixed-count',
    name: 'Loop Controller - Fixed Count',
    description: 'Test loop controller with fixed iteration count',
    nodeType: 'loop-controller',
    category: 'controllers',
    config: {
      type: 'loop-controller',
      loopCount: 5,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.iterations === 5,
    },
    timeout: 10000,
    tags: ['controller', 'loop', 'basic'],
  },
  {
    id: 'loop-single-iteration',
    name: 'Loop Controller - Single Iteration',
    description: 'Test loop controller with single iteration',
    nodeType: 'loop-controller',
    category: 'controllers',
    config: {
      type: 'loop-controller',
      loopCount: 1,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'loop'],
  },
  {
    id: 'loop-zero-iterations',
    name: 'Loop Controller - Zero Iterations',
    description: 'Test loop controller with zero iterations (skip children)',
    nodeType: 'loop-controller',
    category: 'controllers',
    config: {
      type: 'loop-controller',
      loopCount: 0,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'loop', 'edge'],
  },

  // ============================================================================
  // WHILE CONTROLLER TESTS
  // ============================================================================
  {
    id: 'while-simple-condition',
    name: 'While Controller - Simple Condition',
    description: 'Test while controller with simple boolean condition',
    nodeType: 'while-controller',
    category: 'controllers',
    config: {
      type: 'while-controller',
      condition: '${__javaScript(${counter} < 3)}',
    },
    inputs: { counter: 0 },
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'while'],
  },
  {
    id: 'while-string-condition',
    name: 'While Controller - String Condition',
    description: 'Test while controller with string comparison',
    nodeType: 'while-controller',
    category: 'controllers',
    config: {
      type: 'while-controller',
      condition: '${__groovy(vars.get("status") != "done")}',
    },
    inputs: { status: 'pending' },
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'while', 'string'],
  },
  {
    id: 'while-false-initial',
    name: 'While Controller - False Initial Condition',
    description: 'Test while controller that never executes',
    nodeType: 'while-controller',
    category: 'controllers',
    config: {
      type: 'while-controller',
      condition: 'false',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'while', 'edge'],
  },

  // ============================================================================
  // FOREACH CONTROLLER TESTS
  // ============================================================================
  {
    id: 'foreach-array',
    name: 'ForEach Controller - Array Iteration',
    description: 'Test foreach controller iterating over array',
    nodeType: 'foreach-controller',
    category: 'controllers',
    config: {
      type: 'foreach-controller',
      inputVariable: 'items',
      outputVariable: 'currentItem',
      useSeparator: true,
    },
    inputs: { items: ['a', 'b', 'c'] },
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'foreach'],
  },
  {
    id: 'foreach-with-index',
    name: 'ForEach Controller - With Start/End Index',
    description: 'Test foreach controller with index range',
    nodeType: 'foreach-controller',
    category: 'controllers',
    config: {
      type: 'foreach-controller',
      inputVariable: 'items',
      outputVariable: 'currentItem',
      startIndex: 1,
      endIndex: 3,
      useSeparator: true,
    },
    inputs: { items: ['a', 'b', 'c', 'd', 'e'] },
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'foreach', 'index'],
  },
  {
    id: 'foreach-empty-array',
    name: 'ForEach Controller - Empty Array',
    description: 'Test foreach controller with empty input',
    nodeType: 'foreach-controller',
    category: 'controllers',
    config: {
      type: 'foreach-controller',
      inputVariable: 'items',
      outputVariable: 'currentItem',
      useSeparator: true,
    },
    inputs: { items: [] },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'foreach', 'edge'],
  },

  // ============================================================================
  // IF CONTROLLER TESTS
  // ============================================================================
  {
    id: 'if-true-condition',
    name: 'If Controller - True Condition',
    description: 'Test if controller with true condition',
    nodeType: 'if-controller',
    category: 'controllers',
    config: {
      type: 'if-controller',
      condition: '${__javaScript(${value} > 10)}',
      useExpression: true,
      evaluateForAllChildren: false,
    },
    inputs: { value: 15 },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'if', 'true'],
  },
  {
    id: 'if-false-condition',
    name: 'If Controller - False Condition',
    description: 'Test if controller with false condition (skip children)',
    nodeType: 'if-controller',
    category: 'controllers',
    config: {
      type: 'if-controller',
      condition: '${__javaScript(${value} > 10)}',
      useExpression: true,
      evaluateForAllChildren: false,
    },
    inputs: { value: 5 },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'if', 'false'],
  },
  {
    id: 'if-string-equals',
    name: 'If Controller - String Equality',
    description: 'Test if controller with string comparison',
    nodeType: 'if-controller',
    category: 'controllers',
    config: {
      type: 'if-controller',
      condition: '"${status}" == "active"',
      useExpression: true,
      evaluateForAllChildren: false,
    },
    inputs: { status: 'active' },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'if', 'string'],
  },

  // ============================================================================
  // SWITCH CONTROLLER TESTS
  // ============================================================================
  {
    id: 'switch-numeric',
    name: 'Switch Controller - Numeric Value',
    description: 'Test switch controller with numeric switch value',
    nodeType: 'switch-controller',
    category: 'controllers',
    config: {
      type: 'switch-controller',
      switchValue: '1',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'switch'],
  },
  {
    id: 'switch-string',
    name: 'Switch Controller - String Value',
    description: 'Test switch controller with string switch value',
    nodeType: 'switch-controller',
    category: 'controllers',
    config: {
      type: 'switch-controller',
      switchValue: 'case_a',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'switch', 'string'],
  },
  {
    id: 'switch-variable',
    name: 'Switch Controller - Variable Value',
    description: 'Test switch controller with variable as switch value',
    nodeType: 'switch-controller',
    category: 'controllers',
    config: {
      type: 'switch-controller',
      switchValue: '${selectedCase}',
    },
    inputs: { selectedCase: '2' },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['controller', 'switch', 'variable'],
  },

  // ============================================================================
  // TRANSACTION CONTROLLER TESTS
  // ============================================================================
  {
    id: 'transaction-basic',
    name: 'Transaction Controller - Basic',
    description: 'Test transaction controller basic functionality',
    nodeType: 'transaction-controller',
    category: 'controllers',
    config: {
      type: 'transaction-controller',
      generateParentSample: true,
      includeTimers: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'transaction'],
  },
  {
    id: 'transaction-with-timers',
    name: 'Transaction Controller - Include Timers',
    description: 'Test transaction controller with timer inclusion',
    nodeType: 'transaction-controller',
    category: 'controllers',
    config: {
      type: 'transaction-controller',
      generateParentSample: true,
      includeTimers: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'transaction', 'timers'],
  },

  // ============================================================================
  // PARALLEL CONTROLLER TESTS
  // ============================================================================
  {
    id: 'parallel-basic',
    name: 'Parallel Controller - Basic',
    description: 'Test parallel controller with default concurrency',
    nodeType: 'parallel-controller',
    category: 'controllers',
    config: {
      type: 'parallel-controller',
      maxThreads: 4,
      generateParentSample: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 15000,
    tags: ['controller', 'parallel'],
  },
  {
    id: 'parallel-limited',
    name: 'Parallel Controller - Limited Threads',
    description: 'Test parallel controller with limited thread count',
    nodeType: 'parallel-controller',
    category: 'controllers',
    config: {
      type: 'parallel-controller',
      maxThreads: 2,
      generateParentSample: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 15000,
    tags: ['controller', 'parallel', 'limited'],
  },

  // ============================================================================
  // THROUGHPUT CONTROLLER TESTS
  // ============================================================================
  {
    id: 'throughput-percent',
    name: 'Throughput Controller - Percent Executions',
    description: 'Test throughput controller with percentage mode',
    nodeType: 'throughput-controller',
    category: 'controllers',
    config: {
      type: 'throughput-controller',
      style: 'percent-executions',
      throughput: 50,
      perThread: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'throughput', 'percent'],
  },
  {
    id: 'throughput-total',
    name: 'Throughput Controller - Total Executions',
    description: 'Test throughput controller with total count mode',
    nodeType: 'throughput-controller',
    category: 'controllers',
    config: {
      type: 'throughput-controller',
      style: 'total-executions',
      throughput: 10,
      perThread: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['controller', 'throughput', 'total'],
  },
];

export const timerTests: TestCase[] = [
  // ============================================================================
  // CONSTANT TIMER TESTS
  // ============================================================================
  {
    id: 'constant-timer-basic',
    name: 'Constant Timer - Basic Delay',
    description: 'Test constant timer with fixed delay',
    nodeType: 'constant-timer',
    category: 'timers',
    config: {
      type: 'constant-timer',
      delay: 1000, // 1 second
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      responseTimeMs: { min: 500, max: 2000 },
    },
    timeout: 5000,
    tags: ['timer', 'constant'],
  },
  {
    id: 'constant-timer-zero',
    name: 'Constant Timer - Zero Delay',
    description: 'Test constant timer with zero delay',
    nodeType: 'constant-timer',
    category: 'timers',
    config: {
      type: 'constant-timer',
      delay: 0,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      responseTimeMs: { max: 200 },
    },
    timeout: 5000,
    tags: ['timer', 'constant', 'zero'],
  },
  {
    id: 'constant-timer-long',
    name: 'Constant Timer - Long Delay',
    description: 'Test constant timer with longer delay',
    nodeType: 'constant-timer',
    category: 'timers',
    config: {
      type: 'constant-timer',
      delay: 3000, // 3 seconds
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      responseTimeMs: { min: 2500, max: 4000 },
    },
    timeout: 10000,
    tags: ['timer', 'constant', 'long'],
  },

  // ============================================================================
  // UNIFORM RANDOM TIMER TESTS
  // ============================================================================
  {
    id: 'uniform-random-timer',
    name: 'Uniform Random Timer - Basic',
    description: 'Test uniform random timer',
    nodeType: 'uniform-random-timer',
    category: 'timers',
    config: {
      type: 'uniform-random-timer',
      delay: 1000,
      range: 500, // 1000-1500ms
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      responseTimeMs: { min: 800, max: 2000 },
    },
    timeout: 5000,
    tags: ['timer', 'random', 'uniform'],
  },

  // ============================================================================
  // GAUSSIAN RANDOM TIMER TESTS
  // ============================================================================
  {
    id: 'gaussian-timer-basic',
    name: 'Gaussian Random Timer - Basic',
    description: 'Test gaussian random timer',
    nodeType: 'gaussian-random-timer',
    category: 'timers',
    config: {
      type: 'gaussian-random-timer',
      delay: 2000,
      deviation: 500,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      responseTimeMs: { min: 0, max: 6000 },
    },
    timeout: 10000,
    tags: ['timer', 'random', 'gaussian'],
  },

  // ============================================================================
  // POISSON RANDOM TIMER TESTS
  // ============================================================================
  {
    id: 'poisson-timer-basic',
    name: 'Poisson Random Timer - Basic',
    description: 'Test poisson random timer',
    nodeType: 'poisson-random-timer',
    category: 'timers',
    config: {
      type: 'poisson-random-timer',
      delay: 1000, // lambda
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['timer', 'random', 'poisson'],
  },

  // ============================================================================
  // SYNCHRONIZING TIMER TESTS
  // ============================================================================
  {
    id: 'sync-timer-basic',
    name: 'Synchronizing Timer - Basic',
    description: 'Test synchronizing timer',
    nodeType: 'synchronizing-timer',
    category: 'timers',
    config: {
      type: 'synchronizing-timer',
      groupSize: 2,
      timeoutMs: 5000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['timer', 'sync'],
  },

  // ============================================================================
  // CONSTANT THROUGHPUT TIMER TESTS
  // ============================================================================
  {
    id: 'constant-throughput-timer',
    name: 'Constant Throughput Timer - Basic',
    description: 'Test constant throughput timer',
    nodeType: 'constant-throughput-timer',
    category: 'timers',
    config: {
      type: 'constant-throughput-timer',
      targetThroughput: 60, // 60 samples per minute = 1 per second
      calcMode: 'this-thread-only',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['timer', 'throughput'],
  },
];

export default [...controllerTests, ...timerTests];
