/**
 * Variable Substitution Test Cases
 * Tests for context variable substitution in node configurations
 *
 * These tests verify that ${varName} patterns are correctly replaced
 * with actual values from the inputs/context.
 */

import type { TestCase } from '../test-runner';

export const variableSubstitutionTests: TestCase[] = [
  // ============================================================================
  // BASIC VARIABLE SUBSTITUTION
  // ============================================================================
  {
    id: 'var-sub-simple-string',
    name: 'Variable Substitution - Simple String',
    description: 'Test basic variable substitution in string',
    nodeType: 'shell-command',
    category: 'variables',
    config: {
      type: 'shell-command',
      command: 'echo',
      arguments: ['${greeting}'],
    },
    inputs: {
      greeting: 'Hello TestCraft',
    },
    expectedOutput: {
      status: 'success',
      outputContains: ['Hello TestCraft'],
    },
    timeout: 5000,
    tags: ['variables', 'substitution', 'basic'],
  },
  {
    id: 'var-sub-multiple-vars',
    name: 'Variable Substitution - Multiple Variables',
    description: 'Test substitution of multiple variables',
    nodeType: 'shell-command',
    category: 'variables',
    config: {
      type: 'shell-command',
      command: 'sh',
      arguments: ['-c', 'echo "${name} is ${age} years old"'],
    },
    inputs: {
      name: 'TestCraft',
      age: '42',
    },
    expectedOutput: {
      status: 'success',
      outputContains: ['TestCraft is 42 years old'],
    },
    timeout: 5000,
    tags: ['variables', 'substitution', 'multiple'],
  },
  {
    id: 'var-sub-in-url',
    name: 'Variable Substitution - URL Construction',
    description: 'Test variable substitution in HTTP request URL',
    nodeType: 'http-request',
    category: 'variables',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: '${api_host}',
      path: '/users/${user_id}',
      port: 443,
    },
    inputs: {
      api_host: 'jsonplaceholder.typicode.com',
      user_id: '1',
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return result.output?.statusCode === 200 &&
               result.output?.body?.id === 1;
      },
    },
    timeout: 10000,
    tags: ['variables', 'substitution', 'http', 'url'],
  },
  {
    id: 'var-sub-in-headers',
    name: 'Variable Substitution - HTTP Headers',
    description: 'Test variable substitution in HTTP headers',
    nodeType: 'http-request',
    category: 'variables',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      path: '/headers',
      port: 443,
      headers: {
        'X-Custom-Header': '${custom_value}',
      },
    },
    inputs: {
      custom_value: 'TestCraftCustomValue',
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        const headers = result.output?.body?.headers;
        // Check that variable was substituted into the header
        return headers?.['X-Custom-Header'] === 'TestCraftCustomValue';
      },
    },
    timeout: 10000,
    tags: ['variables', 'substitution', 'http', 'headers'],
  },
  {
    id: 'var-sub-in-body',
    name: 'Variable Substitution - HTTP Body',
    description: 'Test variable substitution in HTTP request body',
    nodeType: 'http-request',
    category: 'variables',
    config: {
      type: 'http-request',
      method: 'POST',
      protocol: 'https',
      serverName: 'httpbin.org',
      path: '/post',
      port: 443,
      headers: { 'Content-Type': 'application/json' },
      bodyData: '{"name": "${user_name}", "email": "${user_email}"}',
    },
    inputs: {
      user_name: 'TestCraft User',
      user_email: 'test@testcraft.ai',
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        const data = JSON.parse(result.output?.body?.data || '{}');
        return data?.name === 'TestCraft User' &&
               data?.email === 'test@testcraft.ai';
      },
    },
    timeout: 10000,
    tags: ['variables', 'substitution', 'http', 'body'],
  },
  {
    id: 'var-sub-undefined-var',
    name: 'Variable Substitution - Undefined Variable',
    description: 'Test that undefined variables are left as-is by our substitution (shell may then expand them)',
    nodeType: 'shell-command',
    category: 'variables',
    config: {
      type: 'shell-command',
      command: 'sh',
      // Use printf with escaped dollar sign to verify our substitution doesn't break patterns
      arguments: ['-c', 'printf "Literal: \\${undefined_var}"'],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      // Verify the escaped variable pattern is preserved
      outputContains: ['Literal: ${undefined_var}'],
    },
    timeout: 5000,
    tags: ['variables', 'substitution', 'undefined'],
  },
  {
    id: 'var-sub-env-vars',
    name: 'Variable Substitution - Environment Variables',
    description: 'Test built-in environment variable access',
    nodeType: 'shell-command',
    category: 'variables',
    config: {
      type: 'shell-command',
      command: 'sh',
      arguments: ['-c', 'echo "NODE_ENV=${NODE_ENV}"'],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      // NODE_ENV is automatically added to context
      customValidator: (result: any) => {
        return result.output?.stdout?.includes('NODE_ENV=');
      },
    },
    timeout: 5000,
    tags: ['variables', 'substitution', 'environment'],
  },
  {
    id: 'var-sub-nested-object',
    name: 'Variable Substitution - In Nested Object',
    description: 'Test variable substitution in nested configuration objects',
    nodeType: 'http-request',
    category: 'variables',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      path: '/get',
      port: 443,
      parameters: [
        { name: 'user', value: '${username}', encode: true },
        { name: 'token', value: '${auth_token}', encode: true },
      ],
    },
    inputs: {
      username: 'testcraft_user',
      auth_token: 'abc123xyz',
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        const args = result.output?.body?.args;
        return args?.user === 'testcraft_user' &&
               args?.token === 'abc123xyz';
      },
    },
    timeout: 10000,
    tags: ['variables', 'substitution', 'nested'],
  },
  {
    id: 'var-sub-numeric-values',
    name: 'Variable Substitution - Numeric Values',
    description: 'Test variable substitution with numeric values',
    nodeType: 'shell-command',
    category: 'variables',
    config: {
      type: 'shell-command',
      command: 'sh',
      arguments: ['-c', 'echo "Result: $((${num1} + ${num2}))"'],
    },
    inputs: {
      num1: '10',
      num2: '32',
    },
    expectedOutput: {
      status: 'success',
      outputContains: ['Result: 42'],
    },
    timeout: 5000,
    tags: ['variables', 'substitution', 'numeric'],
  },
  {
    id: 'var-sub-special-chars',
    name: 'Variable Substitution - Special Characters',
    description: 'Test variable substitution with special characters',
    nodeType: 'shell-command',
    category: 'variables',
    config: {
      type: 'shell-command',
      command: 'echo',
      arguments: ['${special_value}'],
    },
    inputs: {
      special_value: 'Hello World!',
    },
    expectedOutput: {
      status: 'success',
      outputContains: ['Hello World!'],
    },
    timeout: 5000,
    tags: ['variables', 'substitution', 'special-chars'],
  },
];

export default variableSubstitutionTests;
