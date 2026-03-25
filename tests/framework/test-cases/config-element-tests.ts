/**
 * Config Element Test Cases
 * HTTP defaults, headers, cookies, auth, etc.
 */

import type { TestCase } from '../test-runner';

export const configElementTests: TestCase[] = [
  // HTTP REQUEST DEFAULTS
  {
    id: 'http-request-defaults',
    name: 'HTTP Request Defaults - Basic',
    description: 'Test HTTP request defaults configuration',
    nodeType: 'http-request-defaults',
    category: 'config',
    config: {
      type: 'http-request-defaults',
      protocol: 'https',
      serverName: 'api.example.com',
      port: 443,
      path: '/api/v1',
      encoding: 'UTF-8',
      connectTimeout: 5000,
      responseTimeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.serverName === 'api.example.com' &&
        result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['config', 'http-defaults'],
  },

  // HTTP HEADER MANAGER
  {
    id: 'http-header-manager',
    name: 'HTTP Header Manager - Multiple Headers',
    description: 'Test HTTP header manager with multiple headers',
    nodeType: 'http-header-manager',
    category: 'config',
    config: {
      type: 'http-header-manager',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Accept', value: 'application/json' },
        { name: 'Authorization', value: 'Bearer token123' },
      ],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.headerCount === 3,
    },
    timeout: 5000,
    tags: ['config', 'headers'],
  },

  // HTTP COOKIE MANAGER
  {
    id: 'http-cookie-manager',
    name: 'HTTP Cookie Manager - Basic',
    description: 'Test HTTP cookie manager',
    nodeType: 'http-cookie-manager',
    category: 'config',
    config: {
      type: 'http-cookie-manager',
      clearEachIteration: true,
      cookiePolicy: 'standard',
      cookies: [
        { name: 'session', value: 'abc123', domain: '.example.com' },
      ],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.cookieCount === 1 &&
        result.output?.clearEachIteration === true,
    },
    timeout: 5000,
    tags: ['config', 'cookies'],
  },

  // HTTP CACHE MANAGER
  {
    id: 'http-cache-manager',
    name: 'HTTP Cache Manager - Basic',
    description: 'Test HTTP cache manager',
    nodeType: 'http-cache-manager',
    category: 'config',
    config: {
      type: 'http-cache-manager',
      clearEachIteration: false,
      useExpires: true,
      maxSize: 10000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.maxSize === 10000,
    },
    timeout: 5000,
    tags: ['config', 'cache'],
  },

  // HTTP AUTHORIZATION MANAGER
  {
    id: 'http-authorization-manager',
    name: 'HTTP Authorization Manager - Basic Auth',
    description: 'Test HTTP authorization manager',
    nodeType: 'http-authorization-manager',
    category: 'config',
    config: {
      type: 'http-authorization-manager',
      authorizations: [
        { url: 'https://api.example.com', username: 'user1', mechanism: 'BASIC' },
      ],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.authCount === 1,
    },
    timeout: 5000,
    tags: ['config', 'auth'],
  },

  // JDBC CONNECTION CONFIG
  {
    id: 'jdbc-connection-config',
    name: 'JDBC Connection Config - PostgreSQL',
    description: 'Test JDBC connection configuration',
    nodeType: 'jdbc-connection-config',
    category: 'config',
    config: {
      type: 'jdbc-connection-config',
      variableName: 'dbConnection',
      databaseUrl: 'jdbc:postgresql://localhost:5432/testdb',
      driverClass: 'org.postgresql.Driver',
      username: 'testuser',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.variableName === 'dbConnection' &&
        result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['config', 'jdbc'],
  },

  // KEYSTORE CONFIG
  {
    id: 'keystore-config',
    name: 'Keystore Config - Basic',
    description: 'Test keystore configuration',
    nodeType: 'keystore-config',
    category: 'config',
    config: {
      type: 'keystore-config',
      preload: true,
      variableName: 'keystore',
      keystorePath: '/path/to/keystore.jks',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.preload === true,
    },
    timeout: 5000,
    tags: ['config', 'keystore'],
  },

  // LOGIN CONFIG
  {
    id: 'login-config',
    name: 'Login Config - Basic',
    description: 'Test login configuration',
    nodeType: 'login-config',
    category: 'config',
    config: {
      type: 'login-config',
      username: 'testuser',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.hasCredentials === true,
    },
    timeout: 5000,
    tags: ['config', 'login'],
  },

  // CSV DATA SET
  {
    id: 'csv-data-set',
    name: 'CSV Data Set - Basic',
    description: 'Test CSV data set configuration',
    nodeType: 'csv-data-set',
    category: 'config',
    config: {
      type: 'csv-data-set',
      filename: '/data/users.csv',
      variableNames: 'username,password,email',
      delimiter: ',',
      ignoreFirstLine: true,
      recycle: true,
      stopThread: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.variableNames === 'username,password,email' &&
        result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['config', 'csv'],
  },

  // COUNTER
  {
    id: 'counter-basic',
    name: 'Counter - Basic Increment',
    description: 'Test counter configuration',
    nodeType: 'counter',
    category: 'config',
    config: {
      type: 'counter',
      variableName: 'counter',
      start: 1,
      end: 100,
      increment: 1,
      perThread: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.currentValue === 2 &&
        result.extractedValues?.counter === 2,
    },
    timeout: 5000,
    tags: ['config', 'counter'],
  },

  // RANDOM VARIABLE
  {
    id: 'random-variable',
    name: 'Random Variable - Range',
    description: 'Test random variable generation',
    nodeType: 'random-variable',
    category: 'config',
    config: {
      type: 'random-variable',
      variableName: 'randomNum',
      minimum: 1,
      maximum: 100,
      perThread: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        const value = Number(result.output?.value);
        return value >= 1 && value <= 100;
      },
    },
    timeout: 5000,
    tags: ['config', 'random'],
  },

  // USER DEFINED VARIABLES
  {
    id: 'user-defined-variables',
    name: 'User Defined Variables - Multiple',
    description: 'Test user defined variables',
    nodeType: 'user-defined-variables',
    category: 'config',
    config: {
      type: 'user-defined-variables',
      variables: [
        { name: 'baseUrl', value: 'https://api.example.com' },
        { name: 'apiKey', value: 'key123' },
        { name: 'timeout', value: '30000' },
      ],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.variableCount === 3 &&
        result.extractedValues?.baseUrl === 'https://api.example.com',
    },
    timeout: 5000,
    tags: ['config', 'variables'],
  },

  // DNS CACHE MANAGER
  {
    id: 'dns-cache-manager',
    name: 'DNS Cache Manager - Basic',
    description: 'Test DNS cache manager',
    nodeType: 'dns-cache-manager',
    category: 'config',
    config: {
      type: 'dns-cache-manager',
      clearEachIteration: true,
      hosts: [
        { name: 'api.local', address: '127.0.0.1' },
      ],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.hostCount === 1,
    },
    timeout: 5000,
    tags: ['config', 'dns'],
  },
];

export default configElementTests;
