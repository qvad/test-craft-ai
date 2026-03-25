/**
 * Database Test Cases
 * Tests for YugabyteDB/PostgreSQL database operations
 *
 * NOTE: These tests require a running YugabyteDB or PostgreSQL instance.
 * Set YUGABYTE_HOST, YUGABYTE_PORT, etc. environment variables.
 */

import type { TestCase } from '../test-runner';

export const databaseTests: TestCase[] = [
  // ============================================================================
  // YUGABYTE/POSTGRESQL CONNECTION TESTS
  // ============================================================================
  {
    id: 'db-connection-basic',
    name: 'Database - Basic Connection',
    description: 'Test basic connection to YugabyteDB/PostgreSQL',
    nodeType: 'yugabyte-request',
    category: 'database',
    config: {
      type: 'yugabyte-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      query: 'SELECT 1 as test_value',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return result.output?.rows?.[0]?.test_value === 1;
      },
    },
    timeout: 10000,
    tags: ['database', 'yugabyte', 'connection'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
  {
    id: 'db-query-select',
    name: 'Database - SELECT Query',
    description: 'Test SELECT query execution',
    nodeType: 'yugabyte-request',
    category: 'database',
    config: {
      type: 'yugabyte-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      query: 'SELECT current_timestamp as ts, current_database() as db',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return result.output?.rows?.length === 1 &&
               result.output?.rows?.[0]?.db !== undefined;
      },
    },
    timeout: 10000,
    tags: ['database', 'yugabyte', 'select'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
  {
    id: 'db-query-parameterized',
    name: 'Database - Parameterized Query',
    description: 'Test parameterized query execution',
    nodeType: 'yugabyte-request',
    category: 'database',
    config: {
      type: 'yugabyte-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      query: 'SELECT $1::text as param1, $2::integer as param2',
      parameters: ['hello', 42],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return result.output?.rows?.[0]?.param1 === 'hello' &&
               result.output?.rows?.[0]?.param2 === 42;
      },
    },
    timeout: 10000,
    tags: ['database', 'yugabyte', 'parameterized'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
  {
    id: 'db-create-and-drop-table',
    name: 'Database - Create and Drop Table',
    description: 'Test DDL operations (create table if not exists)',
    nodeType: 'yugabyte-request',
    category: 'database',
    config: {
      type: 'yugabyte-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      // Single DDL statement that always succeeds
      query: 'CREATE TABLE IF NOT EXISTS test_ddl_temp (id SERIAL PRIMARY KEY, name TEXT)',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 15000,
    tags: ['database', 'yugabyte', 'ddl'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
  {
    id: 'db-connection-error',
    name: 'Database - Connection Error Handling',
    description: 'Test handling of connection errors (invalid host)',
    nodeType: 'yugabyte-request',
    category: 'database',
    config: {
      type: 'yugabyte-request',
      host: 'nonexistent-host-that-does-not-exist',
      port: 5433,
      database: 'testcraft',
      user: 'yugabyte',
      password: 'yugabyte',
      query: 'SELECT 1',
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
    },
    timeout: 15000,
    tags: ['database', 'yugabyte', 'error'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
  {
    id: 'db-query-syntax-error',
    name: 'Database - SQL Syntax Error',
    description: 'Test handling of SQL syntax errors',
    nodeType: 'yugabyte-request',
    category: 'database',
    config: {
      type: 'yugabyte-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      query: 'SELEKT invalid syntax here',
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
    },
    timeout: 10000,
    tags: ['database', 'yugabyte', 'error'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
];

// Alias tests for postgresql-request and database-request (same handler)
export const aliasTests: TestCase[] = [
  {
    id: 'postgresql-request-basic',
    name: 'PostgreSQL Request - Basic (Alias)',
    description: 'Test postgresql-request alias uses yugabyte handler',
    nodeType: 'postgresql-request',
    category: 'database',
    config: {
      type: 'postgresql-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      query: 'SELECT 1 as alias_test',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.rows?.[0]?.alias_test === 1,
    },
    timeout: 10000,
    tags: ['database', 'postgresql', 'alias'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
  {
    id: 'database-request-basic',
    name: 'Database Request - Basic (Alias)',
    description: 'Test database-request alias uses yugabyte handler',
    nodeType: 'database-request',
    category: 'database',
    config: {
      type: 'database-request',
      host: process.env.YUGABYTE_HOST || 'localhost',
      port: parseInt(process.env.YUGABYTE_PORT || '5433', 10),
      database: process.env.YUGABYTE_DB || 'testcraft',
      user: process.env.YUGABYTE_USER || 'yugabyte',
      password: process.env.YUGABYTE_PASSWORD || 'yugabyte',
      query: 'SELECT 2 as generic_test',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.rows?.[0]?.generic_test === 2,
    },
    timeout: 10000,
    tags: ['database', 'generic', 'alias'],
    skip: process.env.SKIP_DB_TESTS === 'true',
  },
];

// Filter out skipped tests
export default [...databaseTests, ...aliasTests].filter(t => !t.skip);
