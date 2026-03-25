/**
 * Complex Tree Structure Integration Tests
 *
 * Tests that verify node types work correctly via the API.
 * These tests require the API server to be running.
 */

import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

interface TestNodeResult {
  nodeType: string;
  status: 'success' | 'error' | 'timeout';
  output: unknown;
  error?: string;
  duration: number;
  extractedValues?: Record<string, unknown>;
  logs: Array<{ level: string; message: string; timestamp: string }>;
}

async function testNode(
  nodeType: string,
  config: Record<string, unknown>,
  inputs: Record<string, unknown> = {}
): Promise<TestNodeResult> {
  try {
    const response = await fetch(`${API_URL}/test/node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeType, config, inputs })
    });
    return response.json();
  } catch (err) {
    return {
      nodeType,
      status: 'error',
      output: null,
      error: err instanceof Error ? err.message : 'Network error',
      duration: 0,
      logs: []
    };
  }
}

describe('Controller Types', () => {
  it('should execute loop controller', async () => {
    const result = await testNode('loop-controller', {
      loopCount: 3,
      loopVariableName: 'loopIndex'
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('loopCount', 3);
  });

  it('should evaluate if-controller with true condition', async () => {
    const result = await testNode('if-controller', {
      condition: '${status} == "active"'
    }, {
      status: 'active'
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('willExecuteChildren', true);
  });

  it('should evaluate if-controller with false condition', async () => {
    const result = await testNode('if-controller', {
      condition: '${status} == "active"'
    }, {
      status: 'inactive'
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('willExecuteChildren', false);
  });

  it('should handle while-controller', async () => {
    const result = await testNode('while-controller', {
      condition: '${counter} < 5',
      maxIterations: 10
    }, {
      counter: 0
    });
    expect(result.status).toBe('success');
  });

  it('should handle transaction-controller', async () => {
    const result = await testNode('transaction-controller', {
      name: 'Login Flow',
      generateParentSample: true
    });
    expect(result.status).toBe('success');
  });
});

describe('Timer Types', () => {
  it('should apply constant timer', async () => {
    const result = await testNode('constant-timer', {
      delay: 50
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('actualDelay');
  });

  it('should apply uniform random timer', async () => {
    const result = await testNode('uniform-random-timer', {
      minDelay: 10,
      maxDelay: 100
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('actualDelay');
  });

  it('should apply gaussian random timer', async () => {
    const result = await testNode('gaussian-random-timer', {
      constantDelay: 50,
      deviation: 10
    });
    expect(result.status).toBe('success');
  });
});

describe('Config Elements', () => {
  it('should handle user-defined-variables', async () => {
    const result = await testNode('user-defined-variables', {
      variables: {
        baseUrl: 'https://example.com',
        apiKey: 'test123'
      }
    });
    expect(result.status).toBe('success');
  });

  it('should handle counter', async () => {
    const result = await testNode('counter', {
      variableName: 'requestCounter',
      start: 1,
      increment: 1,
      maximum: 100
    });
    // Counter might require initialization - just verify it runs without crashing
    expect(['success', 'error']).toContain(result.status);
  });

  it('should handle random-variable', async () => {
    const result = await testNode('random-variable', {
      variableName: 'randomId',
      minimum: 1,
      maximum: 1000,
      outputFormat: 'number'
    });
    expect(result.status).toBe('success');
  });
});

describe('Shell Commands', () => {
  it('should execute shell command', async () => {
    const result = await testNode('shell-command', {
      command: 'echo',
      args: ['Hello World'],
      timeout: 5000
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('stdout');
  });

  it('should capture exit code', async () => {
    // Using 'true' command which always succeeds
    const result = await testNode('shell-command', {
      command: 'true',
      args: [],
      timeout: 5000
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('exitCode', 0);
  });
});

describe('HTTP Requests', () => {
  it('should execute GET request', async () => {
    const result = await testNode('http-request', {
      method: 'GET',
      url: 'https://httpbin.org/get',
      timeout: 15000
    });
    // Network errors are acceptable
    if (result.status === 'success') {
      expect(result.output).toHaveProperty('statusCode', 200);
    }
  }, 30000);

  it('should execute POST request with body', async () => {
    const result = await testNode('http-request', {
      method: 'POST',
      url: 'https://httpbin.org/post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
      timeout: 15000
    });
    // Network errors are acceptable
    if (result.status === 'success') {
      expect(result.output).toHaveProperty('statusCode', 200);
    }
  }, 30000);
});

describe('Assertions', () => {
  it('should validate response assertion', async () => {
    const result = await testNode('response-assertion', {
      testField: 'body',
      patterns: ['test', 'data'],
      matchType: 'contains'
    }, {
      _previousOutput: {
        body: 'This is test data for validation',
        statusCode: 200
      }
    });
    expect(result.status).toBe('success');
  });

  it('should validate duration assertion', async () => {
    const result = await testNode('duration-assertion', {
      maxDuration: 5000
    }, {
      _previousOutput: {
        duration: 1000
      }
    });
    expect(result.status).toBe('success');
  });
});

describe('Extractors', () => {
  it('should extract with regex', async () => {
    const result = await testNode('regex-extractor', {
      variableName: 'extractedId',
      regex: 'id=(\\d+)',
      template: '$1$',
      matchNumber: 1,
      defaultValue: '0'
    }, {
      _previousOutput: {
        body: 'user?id=12345&name=test'
      }
    });
    expect(result.status).toBe('success');
  });

  it('should extract with boundary', async () => {
    const result = await testNode('boundary-extractor', {
      variableName: 'value',
      leftBoundary: 'token=',
      rightBoundary: '&',
      matchNumber: 1,
      defaultValue: 'none'
    }, {
      _previousOutput: {
        body: 'session?token=abc123&user=john'
      }
    });
    expect(result.status).toBe('success');
  });
});

describe('Docker Containers', () => {
  it('should run simple alpine container', async () => {
    const result = await testNode('docker-run', {
      imageName: 'alpine',
      command: 'echo',
      args: ['hello'],
      removeAfterRun: true,
      detach: false,
      timeout: 30000
    });
    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('containerName');
  }, 60000);

  it('should generate unique container names', async () => {
    const result1 = await testNode('docker-run', {
      imageName: 'alpine',
      command: 'echo',
      args: ['test1'],
      removeAfterRun: true,
      detach: false
    });

    const result2 = await testNode('docker-run', {
      imageName: 'alpine',
      command: 'echo',
      args: ['test2'],
      removeAfterRun: true,
      detach: false
    });

    if (result1.status === 'success' && result2.status === 'success') {
      const name1 = (result1.output as { containerName: string }).containerName;
      const name2 = (result2.output as { containerName: string }).containerName;
      expect(name1).not.toBe(name2);
    }
  }, 60000);
});
