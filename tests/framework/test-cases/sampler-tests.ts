/**
 * Sampler Node Test Cases
 * Tests for HTTP, JDBC, GraphQL, gRPC, WebSocket, Kafka, MongoDB, Redis, Shell
 */

import type { TestCase } from '../test-runner';

export const samplerTests: TestCase[] = [
  // ============================================================================
  // HTTP REQUEST TESTS
  // ============================================================================
  {
    id: 'http-get-basic',
    name: 'HTTP GET - Basic Request',
    description: 'Test basic HTTP GET request',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/get',
      headers: {},
      parameters: [],
      followRedirects: true,
      useKeepAlive: true,
      connectTimeout: 5000,
      responseTimeout: 10000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"url":', '"headers":'],
    },
    timeout: 15000,
    tags: ['http', 'get', 'basic', 'smoke'],
  },
  {
    id: 'http-get-with-params',
    name: 'HTTP GET - With Query Parameters',
    description: 'Test HTTP GET request with query parameters',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/get',
      headers: {},
      parameters: [
        { name: 'foo', value: 'bar', encoded: false },
        { name: 'baz', value: '123', encoded: false },
      ],
      followRedirects: true,
      useKeepAlive: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"foo":"bar"', '"baz":"123"'],
    },
    timeout: 15000,
    tags: ['http', 'get', 'params'],
  },
  {
    id: 'http-get-with-headers',
    name: 'HTTP GET - With Custom Headers',
    description: 'Test HTTP GET request with custom headers',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/headers',
      headers: {
        'X-Custom-Header': 'test-value',
        'Accept': 'application/json',
      },
      parameters: [],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"X-Custom-Header":"test-value"'],
    },
    timeout: 15000,
    tags: ['http', 'get', 'headers'],
  },
  {
    id: 'http-post-json',
    name: 'HTTP POST - JSON Body',
    description: 'Test HTTP POST request with JSON body',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'POST',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/post',
      headers: {
        'Content-Type': 'application/json',
      },
      parameters: [],
      bodyData: JSON.stringify({ name: 'test', value: 123 }),
      bodyType: 'raw',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"name":"test"', '"value":123'],
    },
    timeout: 15000,
    tags: ['http', 'post', 'json'],
  },
  {
    id: 'http-post-form',
    name: 'HTTP POST - Form Data',
    description: 'Test HTTP POST request with form data',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'POST',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      parameters: [
        { name: 'username', value: 'testuser', encoded: false },
        { name: 'password', value: 'testpass', encoded: false },
      ],
      bodyType: 'x-www-form-urlencoded',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"username":"testuser"'],
    },
    timeout: 15000,
    tags: ['http', 'post', 'form'],
  },
  {
    id: 'http-put-update',
    name: 'HTTP PUT - Update Resource',
    description: 'Test HTTP PUT request for updating a resource',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'PUT',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/put',
      headers: {
        'Content-Type': 'application/json',
      },
      bodyData: JSON.stringify({ id: 1, name: 'updated' }),
      bodyType: 'raw',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"id":1', '"name":"updated"'],
    },
    timeout: 15000,
    tags: ['http', 'put'],
  },
  {
    id: 'http-delete',
    name: 'HTTP DELETE - Remove Resource',
    description: 'Test HTTP DELETE request',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'DELETE',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/delete',
      headers: {},
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
    },
    timeout: 15000,
    tags: ['http', 'delete'],
  },
  {
    id: 'http-patch',
    name: 'HTTP PATCH - Partial Update',
    description: 'Test HTTP PATCH request for partial update',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'PATCH',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/patch',
      headers: {
        'Content-Type': 'application/json',
      },
      bodyData: JSON.stringify({ field: 'patched' }),
      bodyType: 'raw',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"field":"patched"'],
    },
    timeout: 15000,
    tags: ['http', 'patch'],
  },
  {
    id: 'http-redirect',
    name: 'HTTP GET - Follow Redirects',
    description: 'Test HTTP request following redirects',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/redirect/3',
      followRedirects: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"url":'],
    },
    timeout: 30000,
    tags: ['http', 'redirect'],
  },
  {
    id: 'http-basic-auth',
    name: 'HTTP GET - Basic Authentication',
    description: 'Test HTTP request with basic auth',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/basic-auth/user/passwd',
      headers: {
        'Authorization': 'Basic dXNlcjpwYXNzd2Q=', // user:passwd
      },
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"authenticated":true'],
    },
    timeout: 15000,
    tags: ['http', 'auth', 'basic'],
  },
  {
    id: 'http-status-404',
    name: 'HTTP GET - 404 Not Found',
    description: 'Test HTTP request that returns 404',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/status/404',
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
      statusCodes: [404],
    },
    timeout: 15000,
    tags: ['http', 'error', '404'],
  },
  {
    id: 'http-status-500',
    name: 'HTTP GET - 500 Server Error',
    description: 'Test HTTP request that returns 500',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/status/500',
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
      statusCodes: [500],
    },
    timeout: 15000,
    tags: ['http', 'error', '500'],
  },
  {
    id: 'http-timeout',
    name: 'HTTP GET - Timeout Handling',
    description: 'Test HTTP request timeout handling',
    nodeType: 'http-request',
    category: 'samplers',
    config: {
      type: 'http-request',
      method: 'GET',
      protocol: 'https',
      serverName: 'httpbin.org',
      port: 443,
      path: '/delay/10',
      responseTimeout: 2000,
    },
    inputs: {},
    expectedOutput: {
      status: 'timeout',
    },
    timeout: 10000,  // Give backend time to handle the timeout
    tags: ['http', 'timeout'],
  },

  // ============================================================================
  // GRAPHQL REQUEST TESTS
  // ============================================================================
  {
    id: 'graphql-query',
    name: 'GraphQL - Basic Query',
    description: 'Test basic GraphQL query',
    nodeType: 'graphql-request',
    category: 'samplers',
    config: {
      type: 'graphql-request',
      endpoint: 'https://countries.trevorblades.com/graphql',
      query: `
        query {
          countries {
            code
            name
          }
        }
      `,
      headers: {
        'Content-Type': 'application/json',
      },
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"code":', '"name":'],
    },
    timeout: 15000,
    tags: ['graphql', 'query'],
  },
  {
    id: 'graphql-query-variables',
    name: 'GraphQL - Query with Variables',
    description: 'Test GraphQL query with variables',
    nodeType: 'graphql-request',
    category: 'samplers',
    config: {
      type: 'graphql-request',
      endpoint: 'https://countries.trevorblades.com/graphql',
      query: `
        query getCountry($code: ID!) {
          country(code: $code) {
            name
            capital
            currency
          }
        }
      `,
      variables: { code: 'US' },
      headers: {
        'Content-Type': 'application/json',
      },
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      statusCodes: [200],
      outputContains: ['"name":', 'United States'],
    },
    timeout: 15000,
    tags: ['graphql', 'variables'],
  },

  // ============================================================================
  // SHELL COMMAND TESTS
  // ============================================================================
  {
    id: 'shell-echo',
    name: 'Shell - Echo Command',
    description: 'Test basic shell echo command',
    nodeType: 'shell-command',
    category: 'samplers',
    config: {
      type: 'shell-command',
      command: 'echo',
      arguments: ['Hello, World!'],
      expectedReturnCode: 0,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Hello, World!'],
    },
    timeout: 5000,
    tags: ['shell', 'echo', 'basic'],
  },
  {
    id: 'shell-env-var',
    name: 'Shell - Environment Variable',
    description: 'Test shell command with environment variable',
    nodeType: 'shell-command',
    category: 'samplers',
    config: {
      type: 'shell-command',
      command: 'sh',
      arguments: ['-c', 'echo $MY_VAR'],
      environmentVariables: { MY_VAR: 'test-value' },
      expectedReturnCode: 0,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['test-value'],
    },
    timeout: 5000,
    tags: ['shell', 'env'],
  },
  {
    id: 'shell-exit-code',
    name: 'Shell - Non-Zero Exit Code',
    description: 'Test shell command with non-zero exit code',
    nodeType: 'shell-command',
    category: 'samplers',
    config: {
      type: 'shell-command',
      command: 'sh',
      arguments: ['-c', 'exit 1'],
      expectedReturnCode: 1,
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['shell', 'error'],
  },
  {
    id: 'shell-pipe',
    name: 'Shell - Piped Commands',
    description: 'Test shell command with pipes',
    nodeType: 'shell-command',
    category: 'samplers',
    config: {
      type: 'shell-command',
      command: 'sh',
      arguments: ['-c', 'echo "line1\nline2\nline3" | wc -l'],
      expectedReturnCode: 0,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['3'],
    },
    timeout: 5000,
    tags: ['shell', 'pipe'],
  },

  // ============================================================================
  // DATABASE TESTS - See database-tests.ts for YugabyteDB/PostgreSQL tests
  // Redis has been replaced by YugabyteDB (PostgreSQL-compatible)
  // ============================================================================

  // ============================================================================
  // SCRIPT SAMPLER TESTS
  // ============================================================================
  {
    id: 'script-javascript-basic',
    name: 'Script - JavaScript Basic',
    description: 'Test basic JavaScript script execution',
    nodeType: 'script-sampler',
    category: 'samplers',
    config: {
      type: 'script-sampler',
      language: 'javascript',
      script: 'return { result: 1 + 2, message: "Hello" };',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['result', '3'],
    },
    timeout: 5000,
    tags: ['script', 'javascript'],
  },
  {
    id: 'script-javascript-with-input',
    name: 'Script - JavaScript with Input',
    description: 'Test JavaScript script with input variables',
    nodeType: 'script-sampler',
    category: 'samplers',
    config: {
      type: 'script-sampler',
      language: 'javascript',
      script: 'const { x, y } = inputs; return { sum: x + y };',
    },
    inputs: { x: 5, y: 10 },
    expectedOutput: {
      status: 'success',
      outputContains: ['sum', '15'],
    },
    timeout: 5000,
    tags: ['script', 'javascript', 'inputs'],
  },
  {
    id: 'script-python-basic',
    name: 'Script - Python Basic',
    description: 'Test basic Python script execution',
    nodeType: 'script-sampler',
    category: 'samplers',
    config: {
      type: 'script-sampler',
      language: 'python',
      script: 'result = {"value": 42, "status": "ok"}\nprint(result)',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['value', '42'],
    },
    timeout: 10000,
    tags: ['script', 'python'],
  },
];

export default samplerTests;
