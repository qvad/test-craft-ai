/**
 * Global Variable Feedback Loop Tests
 *
 * Verifies that scripts can "push" variables back to the global context.
 */

import type { TestCase } from '../test-runner';

export const globalVariableFlowTests: TestCase[] = [
  {
    id: 'script-feedback-js',
    name: 'Script Feedback - JavaScript',
    description: 'Verify JavaScript script can return an object that becomes extractedValues',
    nodeType: 'script-sampler',
    category: 'variables',
    config: {
      type: 'script-sampler',
      language: 'javascript',
      script: 'return { generated_id: "js-123", status: "complete" };',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      extractedValues: {
        generated_id: 'js-123',
        status: 'complete',
      },
    },
    timeout: 5000,
    tags: ['variables', 'feedback', 'javascript'],
  },
  {
    id: 'script-feedback-complex-types',
    name: 'Script Feedback - Complex Types',
    description: 'Verify nested objects and arrays are correctly returned',
    nodeType: 'script-sampler',
    category: 'variables',
    config: {
      type: 'script-sampler',
      language: 'javascript',
      script: `
        return { 
          user: { id: 1, name: "Alice", roles: ["admin", "user"] },
          metadata: { lastLogin: "2026-03-21T10:00:00Z" }
        };
      `,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      extractedValues: {
        user: { id: 1, name: 'Alice', roles: ['admin', 'user'] },
        metadata: { lastLogin: '2026-03-21T10:00:00Z' },
      },
    },
    timeout: 5000,
    tags: ['variables', 'feedback', 'complex'],
  },
  {
    id: 'script-feedback-variable-shadowing',
    name: 'Script Feedback - Shadowing',
    description: 'Verify node-level variables shadow global ones in the result',
    nodeType: 'script-sampler',
    category: 'variables',
    config: {
      type: 'script-sampler',
      language: 'javascript',
      script: 'return { api_url: "http://local-test:8080" };',
    },
    inputs: {
      api_url: 'http://global-production:9000',
    },
    expectedOutput: {
      status: 'success',
      extractedValues: {
        api_url: 'http://local-test:8080',
      },
    },
    timeout: 5000,
    tags: ['variables', 'feedback', 'shadowing'],
  },
  {
    id: 'script-feedback-numeric-precision',
    name: 'Script Feedback - Numeric Precision',
    description: 'Verify floating point numbers and large integers are preserved',
    nodeType: 'script-sampler',
    category: 'variables',
    config: {
      type: 'script-sampler',
      language: 'javascript',
      script: 'return { pi: 3.1415926535, large: 9007199254740991 };',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      extractedValues: {
        pi: 3.1415926535,
        large: 9007199254740991,
      },
    },
    timeout: 5000,
    tags: ['variables', 'feedback', 'numbers'],
  },
  {
    id: 'script-feedback-simulation',
    name: 'Script Feedback - Simulated (Other Languages)',
    description: 'Verify non-JS scripts return simulated extractedValues in test mode',
    nodeType: 'script-sampler',
    category: 'variables',
    config: {
      type: 'script-sampler',
      language: 'python',
      script: 'print("Setting variables")',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      extractedValues: {
        value: 42,
        status: 'ok',
      },
    },
    timeout: 5000,
    tags: ['variables', 'feedback', 'simulation'],
  },
];

export default globalVariableFlowTests;
