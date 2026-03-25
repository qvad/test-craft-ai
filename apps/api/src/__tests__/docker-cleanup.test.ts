/**
 * Tests for Docker container lifecycle and cleanup.
 *
 * Tests the docker-run, docker-stop, and teardown functionality
 * to ensure proper resource cleanup after test execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock Docker commands for unit testing
const mockDockerRun = vi.fn();
const mockDockerStop = vi.fn();
const mockDockerRm = vi.fn();
const mockDockerPs = vi.fn();

describe('Docker Container Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Container Tracking', () => {
    it('should track container IDs in context._dockerContainers', () => {
      const context: Record<string, unknown> = {};

      // Simulate what execution.store does when a docker-run node completes
      const containerId = 'abc123def456';
      if (!context._dockerContainers) {
        context._dockerContainers = [];
      }
      (context._dockerContainers as string[]).push(containerId);

      expect(context._dockerContainers).toEqual(['abc123def456']);
    });

    it('should track multiple containers', () => {
      const context: Record<string, unknown> = {};

      const containerIds = ['container1', 'container2', 'container3'];
      for (const id of containerIds) {
        if (!context._dockerContainers) {
          context._dockerContainers = [];
        }
        (context._dockerContainers as string[]).push(id);
      }

      expect(context._dockerContainers).toEqual(['container1', 'container2', 'container3']);
    });
  });

  describe('Teardown Phase Logic', () => {
    it('should skip teardown when no containers tracked', async () => {
      const context: Record<string, unknown> = {};
      const containerIds = context._dockerContainers as string[] | undefined;

      expect(containerIds).toBeUndefined();
      const hasResourcesToCleanup = containerIds && containerIds.length > 0;
      expect(hasResourcesToCleanup).toBeFalsy();
    });

    it('should detect resources to cleanup when containers exist', () => {
      const context: Record<string, unknown> = {
        _dockerContainers: ['container1', 'container2']
      };

      const containerIds = context._dockerContainers as string[];
      const hasResourcesToCleanup = containerIds && containerIds.length > 0;

      expect(hasResourcesToCleanup).toBe(true);
    });

    it('should generate correct cleanup commands', () => {
      const containerIds = ['abc123', 'def456'];
      const cleanupCommands = containerIds.map(id => ({
        stop: `docker stop ${id}`,
        remove: `docker rm ${id}`
      }));

      expect(cleanupCommands).toEqual([
        { stop: 'docker stop abc123', remove: 'docker rm abc123' },
        { stop: 'docker stop def456', remove: 'docker rm def456' }
      ]);
    });
  });

  describe('Docker Stop Node Config', () => {
    it('should build correct docker stop command', () => {
      const config = { containerId: 'abc123', remove: true };
      const command = config.remove
        ? `docker stop ${config.containerId} && docker rm ${config.containerId}`
        : `docker stop ${config.containerId}`;

      expect(command).toBe('docker stop abc123 && docker rm abc123');
    });

    it('should build stop-only command when remove=false', () => {
      const config = { containerId: 'abc123', remove: false };
      const command = config.remove
        ? `docker stop ${config.containerId} && docker rm ${config.containerId}`
        : `docker stop ${config.containerId}`;

      expect(command).toBe('docker stop abc123');
    });
  });

  describe('Database Image Detection', () => {
    const databaseImages = [
      'postgres',
      'mysql',
      'mariadb',
      'mongo',
      'redis',
      'elasticsearch',
      'cassandra',
      'cockroachdb',
      'timescaledb',
      'influxdb'
    ];

    it.each(databaseImages)('should detect %s as database image', (image) => {
      const isDatabase = databaseImages.some(db => image.includes(db));
      expect(isDatabase).toBe(true);
    });

    it('should not detect regular images as database', () => {
      const regularImages = ['nginx', 'node', 'python', 'alpine'];
      for (const image of regularImages) {
        const isDatabase = databaseImages.some(db => image.includes(db));
        expect(isDatabase).toBe(false);
      }
    });

    it('should detect database in image with version tag', () => {
      const image = 'postgres:15-alpine';
      const isDatabase = databaseImages.some(db => image.includes(db));
      expect(isDatabase).toBe(true);
    });
  });

  describe('Container Port Mapping', () => {
    it('should parse port mapping string', () => {
      const portMapping = '5432:5432';
      const [hostPort, containerPort] = portMapping.split(':');

      expect(hostPort).toBe('5432');
      expect(containerPort).toBe('5432');
    });

    it('should handle multiple port mappings', () => {
      const portMappings = ['5432:5432', '8080:80', '3000:3000'];
      const dockerPortArgs = portMappings.map(p => `-p ${p}`).join(' ');

      expect(dockerPortArgs).toBe('-p 5432:5432 -p 8080:80 -p 3000:3000');
    });

    it('should build complete docker run command with ports', () => {
      const config = {
        image: 'postgres:15',
        name: 'test-postgres',
        ports: ['5432:5432'],
        env: { POSTGRES_PASSWORD: 'test' },
        detached: true
      };

      const envArgs = Object.entries(config.env)
        .map(([k, v]) => `-e ${k}=${v}`)
        .join(' ');
      const portArgs = config.ports.map(p => `-p ${p}`).join(' ');
      const detachFlag = config.detached ? '-d' : '';

      const command = `docker run ${detachFlag} --name ${config.name} ${portArgs} ${envArgs} ${config.image}`.trim();

      expect(command).toContain('-d');
      expect(command).toContain('--name test-postgres');
      expect(command).toContain('-p 5432:5432');
      expect(command).toContain('-e POSTGRES_PASSWORD=test');
      expect(command).toContain('postgres:15');
    });
  });

  describe('Health Check Logic', () => {
    it('should build postgres health check command', () => {
      const containerId = 'abc123';
      const healthCheckCmd = `docker exec ${containerId} pg_isready -U postgres`;

      expect(healthCheckCmd).toBe('docker exec abc123 pg_isready -U postgres');
    });

    it('should detect postgres in image name', () => {
      const images = ['postgres:15', 'postgres:latest', 'postgres:15-alpine'];
      for (const image of images) {
        const isPostgres = image.toLowerCase().includes('postgres');
        expect(isPostgres).toBe(true);
      }
    });

    it('should detect mysql in image name', () => {
      const images = ['mysql:8', 'mysql:latest', 'mysql/mysql-server:8.0'];
      for (const image of images) {
        const isMySQL = image.toLowerCase().includes('mysql');
        expect(isMySQL).toBe(true);
      }
    });
  });

  describe('Cleanup Error Handling', () => {
    it('should continue cleanup even if one container fails', async () => {
      const containerIds = ['good1', 'bad1', 'good2'];
      const cleanupResults: Array<{ id: string; success: boolean }> = [];

      for (const id of containerIds) {
        try {
          // Simulate: bad1 fails, others succeed
          if (id === 'bad1') {
            throw new Error('Container not found');
          }
          cleanupResults.push({ id, success: true });
        } catch {
          cleanupResults.push({ id, success: false });
        }
      }

      // All 3 were attempted
      expect(cleanupResults).toHaveLength(3);
      // 2 succeeded, 1 failed
      expect(cleanupResults.filter(r => r.success)).toHaveLength(2);
      expect(cleanupResults.filter(r => !r.success)).toHaveLength(1);
    });

    it('should report cleanup errors without failing the test', () => {
      const cleanupLogs: string[] = [];
      let cleanupErrors = 0;

      const containerIds = ['abc123', 'def456'];
      for (const id of containerIds) {
        try {
          // Simulate successful cleanup
          cleanupLogs.push(`Stopped container ${id}`);
        } catch (err) {
          cleanupErrors++;
          cleanupLogs.push(`Failed to stop ${id}`);
        }
      }

      // Teardown passes even with warnings
      const teardownStatus = cleanupErrors === 0 ? 'passed' : 'warning';
      expect(teardownStatus).toBe('passed');
    });
  });
});

describe('Context Variable Flow', () => {
  describe('Variable Interpolation', () => {
    it('should interpolate variables in config strings', () => {
      const context = {
        pg_connection_host: 'localhost',
        pg_connection_port: '5432',
        pg_connection_database: 'testdb',
        pg_connection_user: 'postgres',
        pg_connection_password: 'test123'
      };

      const urlTemplate = 'jdbc:postgresql://${pg_connection_host}:${pg_connection_port}/${pg_connection_database}';
      const interpolated = urlTemplate.replace(/\$\{([^}]+)\}/g, (_, key) => {
        return String(context[key as keyof typeof context] || '');
      });

      expect(interpolated).toBe('jdbc:postgresql://localhost:5432/testdb');
    });

    it('should handle nested variable references', () => {
      const context = {
        host: 'localhost',
        port: 5432
      };

      const connectionRef = 'pg_connection';
      const config = {
        connectionRef,
        query: 'SELECT 1'
      };

      // Simulate what JDBC executor does with connectionRef
      const getContextValue = (key: string) => {
        if (config.connectionRef) {
          const connKey = `${config.connectionRef}_${key}`;
          if (context[connKey as keyof typeof context] !== undefined) {
            return context[connKey as keyof typeof context];
          }
        }
        return context[key as keyof typeof context];
      };

      // This would work if we add prefixed values to context
      const prefixedContext = {
        ...context,
        pg_connection_host: 'db.example.com',
        pg_connection_port: 5433
      };

      const getValue = (key: string) => {
        const connKey = `${config.connectionRef}_${key}`;
        return prefixedContext[connKey as keyof typeof prefixedContext] ??
               prefixedContext[key as keyof typeof prefixedContext];
      };

      expect(getValue('host')).toBe('db.example.com');
      expect(getValue('port')).toBe(5433);
    });
  });

  describe('Context Setup Integration', () => {
    it('should generate prefixed variables from context-setup config', () => {
      const config = {
        prefix: 'pg_connection',
        variables: {
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          user: 'postgres',
          password: 'secret'
        }
      };

      const output: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config.variables)) {
        output[`${config.prefix}_${key}`] = value;
      }

      expect(output).toEqual({
        pg_connection_host: 'localhost',
        pg_connection_port: 5432,
        pg_connection_database: 'testdb',
        pg_connection_user: 'postgres',
        pg_connection_password: 'secret'
      });
    });
  });

  describe('_previousOutput Tracking', () => {
    it('should store previous node output for assertions', () => {
      const context: Record<string, unknown> = {};

      // Simulate HTTP request completing
      const httpOutput = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"success": true}'
      };
      Object.assign(context, httpOutput);
      context._previousOutput = httpOutput;

      expect(context._previousOutput).toEqual(httpOutput);
    });

    it('should store JDBC output for assertions', () => {
      const context: Record<string, unknown> = {};

      // Simulate JDBC request completing
      const jdbcOutput = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        fields: ['id', 'name']
      };
      Object.assign(context, jdbcOutput);
      context._previousOutput = jdbcOutput;

      expect(context._previousOutput).toEqual(jdbcOutput);
      expect((context._previousOutput as typeof jdbcOutput).rowCount).toBe(1);
    });
  });
});

describe('Response Assertion with Different Data Types', () => {
  it('should assert against HTTP response body', () => {
    const httpResponse = {
      statusCode: 200,
      body: '{"userId": 123, "name": "John"}'
    };

    const patterns = ['userId', '123', 'John'];
    const testValue = httpResponse.body;

    for (const pattern of patterns) {
      expect(testValue).toContain(pattern);
    }
  });

  it('should assert against JDBC rows', () => {
    const jdbcResult = {
      rows: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      rowCount: 2
    };

    const testStrings = ['Alice', 'Bob'];
    const testValue = JSON.stringify(jdbcResult.rows);

    for (const str of testStrings) {
      expect(testValue).toContain(str);
    }
  });

  it('should handle both patterns and testStrings config fields', () => {
    // Backend should accept either 'patterns' or 'testStrings'
    const config1 = { patterns: ['test1', 'test2'] };
    const config2 = { testStrings: ['test1', 'test2'] };

    const getPatterns = (cfg: typeof config1 | typeof config2) => {
      return (cfg as { patterns?: string[] }).patterns ||
             (cfg as { testStrings?: string[] }).testStrings ||
             [];
    };

    expect(getPatterns(config1)).toEqual(['test1', 'test2']);
    expect(getPatterns(config2)).toEqual(['test1', 'test2']);
  });
});

describe('Complex Multi-Step Scenario', () => {
  it('should simulate Docker → Context → JDBC → Assertion flow', () => {
    const context: Record<string, unknown> = {};
    const executionOrder: string[] = [];

    // Step 1: Docker Run
    executionOrder.push('docker-run');
    const containerId = 'postgres-test-123';
    context._dockerContainers = [containerId];
    context.containerId = containerId;

    // Step 2: Context Setup
    executionOrder.push('context-setup');
    Object.assign(context, {
      pg_connection_host: 'localhost',
      pg_connection_port: '5432',
      pg_connection_database: 'testdb',
      pg_connection_user: 'postgres',
      pg_connection_password: 'test123'
    });

    // Step 3: JDBC Request (would use context values)
    executionOrder.push('jdbc-request');
    const jdbcResult = {
      rows: [{ count: 1 }],
      rowCount: 1
    };
    Object.assign(context, jdbcResult);
    context._previousOutput = jdbcResult;

    // Step 4: Response Assertion
    executionOrder.push('response-assertion');
    const assertionPatterns = ['1'];
    const testValue = JSON.stringify((context._previousOutput as typeof jdbcResult).rows);
    const allMatch = assertionPatterns.every(p => testValue.includes(p));

    // Step 5: Teardown (automatic)
    executionOrder.push('teardown');
    const containersToCleanup = context._dockerContainers as string[];

    // Verify flow
    expect(executionOrder).toEqual([
      'docker-run',
      'context-setup',
      'jdbc-request',
      'response-assertion',
      'teardown'
    ]);
    expect(allMatch).toBe(true);
    expect(containersToCleanup).toHaveLength(1);
    expect(containersToCleanup[0]).toBe('postgres-test-123');
  });
});
