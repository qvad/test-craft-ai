/**
 * Tests for WebSocket event broadcasting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
    initialize: vi.fn(),
  },
}));

// Mock k8s client
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

import {
  broadcastExecutionEvent,
  broadcastValidationEvent,
  broadcastToAll,
} from '../modules/websocket/routes.js';

describe('WebSocket event broadcasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcastExecutionEvent should be a callable function', () => {
    expect(typeof broadcastExecutionEvent).toBe('function');
  });

  it('broadcastExecutionEvent should not throw with no connected clients', () => {
    expect(() => {
      broadcastExecutionEvent('exec-123', {
        type: 'execution:started',
        executionId: 'exec-123',
        timestamp: Date.now(),
      });
    }).not.toThrow();
  });

  it('broadcastValidationEvent should not throw with no connected clients', () => {
    expect(() => {
      broadcastValidationEvent('node-456', {
        type: 'validation:started',
        nodeId: 'node-456',
        timestamp: Date.now(),
      });
    }).not.toThrow();
  });

  it('broadcastToAll should not throw with no connected clients', () => {
    expect(() => {
      broadcastToAll({
        type: 'system:announcement',
        message: 'test',
        timestamp: Date.now(),
      });
    }).not.toThrow();
  });

  it('broadcastExecutionEvent should accept start event payload', () => {
    const event = {
      type: 'execution:started',
      executionId: 'exec-001',
      language: 'python',
      timestamp: Date.now(),
    };

    // Should not throw — no clients connected
    expect(() => broadcastExecutionEvent('exec-001', event)).not.toThrow();
  });

  it('broadcastExecutionEvent should accept completed event payload', () => {
    const event = {
      type: 'execution:completed',
      executionId: 'exec-002',
      status: 'success',
      exitCode: 0,
      duration: 1500,
      timestamp: Date.now(),
    };

    expect(() => broadcastExecutionEvent('exec-002', event)).not.toThrow();
  });

  it('broadcastExecutionEvent should accept failed event payload', () => {
    const event = {
      type: 'execution:failed',
      executionId: 'exec-003',
      status: 'failed',
      error: 'Runtime error',
      exitCode: 1,
      duration: 500,
      timestamp: Date.now(),
    };

    expect(() => broadcastExecutionEvent('exec-003', event)).not.toThrow();
  });
});
