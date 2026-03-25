/**
 * Tests for execution → reporting integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
    initialize: vi.fn(),
  },
}));

// Mock the k8s client to avoid cluster connection
vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn(),
    deletePod: vi.fn(),
    getPod: vi.fn(),
    execInPod: vi.fn(),
    waitForPodReady: vi.fn(),
  },
  K8sClient: vi.fn(),
}));

import { recordStepResult, getExecutionData } from '../modules/reporting/routes.js';

describe('Execution → Reporting integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordStepResult should populate getExecutionData', () => {
    const executionId = 'test-exec-123';

    // Record a step
    recordStepResult(executionId, {
      id: 'step-1',
      name: 'Python execution',
      type: 'code-execution',
      status: 'passed',
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T00:00:01Z'),
      duration: 1000,
      assertions: [],
      metrics: {
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T00:00:01Z'),
        duration: 1000,
      },
      logs: [],
    });

    const data = getExecutionData(executionId);
    expect(data).toBeDefined();
    expect(data!.steps).toHaveLength(1);
    expect(data!.steps[0].id).toBe('step-1');
    expect(data!.steps[0].status).toBe('passed');
    expect(data!.steps[0].name).toBe('Python execution');
  });

  it('should accumulate multiple step results', () => {
    const executionId = 'test-exec-multi';

    recordStepResult(executionId, {
      id: 'step-1',
      name: 'Step 1',
      type: 'code-execution',
      status: 'passed',
      startTime: new Date(),
      duration: 100,
      assertions: [],
      metrics: { startTime: new Date(), duration: 100 },
      logs: [],
    });

    recordStepResult(executionId, {
      id: 'step-2',
      name: 'Step 2',
      type: 'code-execution',
      status: 'failed',
      startTime: new Date(),
      duration: 200,
      assertions: [],
      error: { message: 'Test failure' },
      metrics: { startTime: new Date(), duration: 200 },
      logs: [],
    });

    const data = getExecutionData(executionId);
    expect(data).toBeDefined();
    expect(data!.steps).toHaveLength(2);
    expect(data!.steps[0].status).toBe('passed');
    expect(data!.steps[1].status).toBe('failed');
    expect(data!.steps[1].error?.message).toBe('Test failure');
  });

  it('should create execution data on first step if none exists', () => {
    const executionId = 'test-exec-new';

    // No prior execution data
    expect(getExecutionData(executionId)).toBeUndefined();

    // Record a step — should auto-create execution data
    recordStepResult(executionId, {
      id: 'step-auto',
      name: 'Auto-created step',
      type: 'code-execution',
      status: 'passed',
      startTime: new Date(),
      duration: 50,
      assertions: [],
      metrics: { startTime: new Date(), duration: 50 },
      logs: [],
    });

    const data = getExecutionData(executionId);
    expect(data).toBeDefined();
    expect(data!.planName).toBe('Unknown');
    expect(data!.steps).toHaveLength(1);
  });
});
