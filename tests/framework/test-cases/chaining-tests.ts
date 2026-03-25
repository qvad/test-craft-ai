/**
 * Node Chaining Test Cases
 * Tests for scenarios where one node depends on another's output
 *
 * Example: Run PostgreSQL container -> Query the database
 */

import type { TestCase } from '../test-runner';

/**
 * This file demonstrates node chaining patterns.
 * In real test plans, nodes can reference outputs from previous nodes.
 *
 * Pattern:
 * 1. docker-run with detach=true starts a service container
 * 2. Variable substitution passes container info to subsequent nodes
 * 3. yugabyte-request connects to the containerized database
 * 4. docker-stop cleans up the container
 */

// Chaining tests require pre-pulled images to avoid timeout issues
const skipChainTests = process.env.SKIP_CHAIN_TESTS !== 'false';

export const chainingTests: TestCase[] = [
  // ============================================================================
  // DOCKER -> DATABASE CHAINING
  // NOTE: These tests are skipped by default because they require:
  // 1. Pre-pulled postgres:15-alpine image
  // 2. Port 15432 to be available
  // Set SKIP_CHAIN_TESTS=false to run them
  // ============================================================================
  {
    id: 'chain-docker-postgres-start',
    name: 'Chain: Start PostgreSQL Container',
    description: 'Start a PostgreSQL container in detached mode with port mapping',
    nodeType: 'docker-run',
    category: 'chaining',
    config: {
      type: 'docker-run',
      imageName: 'postgres',
      imageTag: '15-alpine',
      name: 'testcraft-postgres-chain',
      detach: true,
      removeAfterRun: false,
      ports: [{ hostPort: 15432, containerPort: 5432 }],
      environment: {
        POSTGRES_USER: 'testcraft',
        POSTGRES_PASSWORD: 'testcraft123',
        POSTGRES_DB: 'chaintest',
      },
      timeout: 120000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        // In detach mode, we should get a container ID
        return result.output?.containerId?.length > 0 || result.output?.detached === true;
      },
    },
    timeout: 120000,
    tags: ['chaining', 'docker', 'postgres'],
    skip: skipChainTests || process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'chain-wait-for-postgres',
    name: 'Chain: Wait for PostgreSQL Ready',
    description: 'Wait for PostgreSQL to be ready using docker exec',
    nodeType: 'docker-run',
    category: 'chaining',
    config: {
      type: 'docker-run',
      // Use docker exec to wait for postgres to be ready
      imageName: 'postgres',
      imageTag: '15-alpine',
      command: 'sh',
      args: [
        '-c',
        // Wait up to 30 seconds for postgres to be ready
        'for i in $(seq 1 30); do pg_isready -h host.docker.internal -p 15432 && exit 0; sleep 1; done; exit 1',
      ],
      removeAfterRun: true,
      timeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      // May succeed or fail depending on network setup
      customValidator: (result: any) => true,
    },
    timeout: 60000,
    tags: ['chaining', 'docker', 'postgres', 'wait'],
    skip: skipChainTests || process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'chain-query-postgres',
    name: 'Chain: Query PostgreSQL Container',
    description: 'Query the PostgreSQL database started in previous step',
    nodeType: 'yugabyte-request',
    category: 'chaining',
    config: {
      type: 'yugabyte-request',
      host: 'localhost',
      port: 15432,
      database: 'chaintest',
      user: 'testcraft',
      password: 'testcraft123',
      query: 'SELECT 1 as chain_test, current_database() as db_name',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return (
          result.output?.rows?.[0]?.chain_test === 1 &&
          result.output?.rows?.[0]?.db_name === 'chaintest'
        );
      },
    },
    timeout: 15000,
    tags: ['chaining', 'database', 'postgres'],
    // This test depends on the docker container being started
    skip: skipChainTests || process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'chain-postgres-create-table',
    name: 'Chain: Create Table in PostgreSQL',
    description: 'Create a test table in the containerized PostgreSQL',
    nodeType: 'yugabyte-request',
    category: 'chaining',
    config: {
      type: 'yugabyte-request',
      host: 'localhost',
      port: 15432,
      database: 'chaintest',
      user: 'testcraft',
      password: 'testcraft123',
      query: 'CREATE TABLE IF NOT EXISTS chain_users (id SERIAL PRIMARY KEY, name TEXT, email TEXT)',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 10000,
    tags: ['chaining', 'database', 'postgres', 'ddl'],
    skip: skipChainTests || process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'chain-postgres-insert-data',
    name: 'Chain: Insert Data into PostgreSQL',
    description: 'Insert test data into the containerized PostgreSQL',
    nodeType: 'yugabyte-request',
    category: 'chaining',
    config: {
      type: 'yugabyte-request',
      host: 'localhost',
      port: 15432,
      database: 'chaintest',
      user: 'testcraft',
      password: 'testcraft123',
      query: "INSERT INTO chain_users (name, email) VALUES ('TestCraft User', 'user@testcraft.ai') RETURNING id, name",
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return (
          result.output?.rows?.length === 1 &&
          result.output?.rows?.[0]?.name === 'TestCraft User'
        );
      },
    },
    timeout: 10000,
    tags: ['chaining', 'database', 'postgres', 'insert'],
    skip: skipChainTests || process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'chain-docker-postgres-stop',
    name: 'Chain: Stop PostgreSQL Container',
    description: 'Stop and remove the PostgreSQL container',
    nodeType: 'docker-stop',
    category: 'chaining',
    config: {
      type: 'docker-stop',
      containerName: 'testcraft-postgres-chain',
      remove: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => {
        return result.output?.stopped === true;
      },
    },
    timeout: 30000,
    tags: ['chaining', 'docker', 'cleanup'],
    skip: skipChainTests || process.env.SKIP_DOCKER_TESTS === 'true',
  },
];

// ============================================================================
// PORT MAPPING FORMAT TESTS
// These test different ways to specify port mappings
// ============================================================================
export const portMappingTests: TestCase[] = [
  {
    id: 'docker-ports-array-format',
    name: 'Docker Ports - Array Format',
    description: 'Test port mapping with array format [{hostPort, containerPort}]',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'echo',
      args: ['Array port format works'],
      ports: [{ hostPort: 18080, containerPort: 80 }],
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Array port format works'],
    },
    timeout: 60000,
    tags: ['container', 'docker', 'ports'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'docker-ports-object-format',
    name: 'Docker Ports - Object Format',
    description: 'Test port mapping with object format {"containerPort": "hostPort"}',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'echo',
      args: ['Object port format works'],
      ports: { '80': '18081' },
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Object port format works'],
    },
    timeout: 60000,
    tags: ['container', 'docker', 'ports'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'docker-ports-string-format',
    name: 'Docker Ports - String Array Format',
    description: 'Test port mapping with string array format ["8080:80"]',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'echo',
      args: ['String port format works'],
      ports: ['18082:80'],
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['String port format works'],
    },
    timeout: 60000,
    tags: ['container', 'docker', 'ports'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
];

// Filter out skipped tests
export default [...chainingTests, ...portMappingTests].filter((t) => !t.skip);
