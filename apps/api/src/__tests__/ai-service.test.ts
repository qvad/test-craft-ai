/**
 * Tests for the AI Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from '../modules/ai/ai-service.js';

// Mock fetch
global.fetch = vi.fn();

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCode', () => {
    it('should generate Java code from intent', async () => {
      const mockResponse = {
        code: 'public class Test { public void execute() { } }',
        entryPoint: { methodName: 'execute', signature: '()' },
        dependencies: [],
        contracts: { inputs: [], outputs: [], sideEffects: [], exceptions: [] },
        confidence: 0.9,
        reasoning: 'Generated based on intent',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockResponse) }],
        }),
      } as Response);

      const result = await aiService.generateCode({
        nodeId: 'test-node',
        nodeType: 'jdbc-request',
        intent: 'Query all users from the database',
        language: 'java',
        context: {},
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class');
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(aiService.generateCode({
        nodeId: 'test-node',
        nodeType: 'http-request',
        intent: 'Make a GET request',
        language: 'python',
        context: {},
      })).rejects.toThrow();
    });

    it('should include database schema in context when provided', async () => {
      const mockResponse = {
        code: 'SELECT * FROM users',
        entryPoint: { methodName: 'execute', signature: '()' },
        dependencies: [],
        contracts: { inputs: [], outputs: [], sideEffects: [], exceptions: [] },
        confidence: 0.95,
        reasoning: 'Used schema context',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockResponse) }],
        }),
      } as Response);

      const result = await aiService.generateCode({
        nodeId: 'test-node',
        nodeType: 'jdbc-request',
        intent: 'Get all active users',
        language: 'java',
        context: {
          databaseSchema: {
            tables: [{
              name: 'users',
              columns: [
                { name: 'id', type: 'INT', nullable: false },
                { name: 'email', type: 'VARCHAR', nullable: false },
                { name: 'active', type: 'BOOLEAN', nullable: false },
              ],
            }],
          },
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('generateData', () => {
    it('should generate test data based on schema', async () => {
      const mockData = [
        { name: 'John Doe', email: 'john@example.com', age: 30 },
        { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
      ];

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockData) }],
        }),
      } as Response);

      const result = await aiService.generateData({
        schema: {
          fields: [
            { name: 'name', type: 'string' },
            { name: 'email', type: 'email' },
            { name: 'age', type: 'number', min: 18, max: 100 },
          ],
        },
        count: 2,
        locale: 'en-US',
      });

      expect(result.data).toHaveLength(2);
      expect(result.schema).toBeDefined();
    });

    it('should respect field constraints', async () => {
      const mockData = [
        { status: 'active' },
        { status: 'inactive' },
      ];

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockData) }],
        }),
      } as Response);

      const result = await aiService.generateData({
        schema: {
          fields: [
            { name: 'status', type: 'enum', enumValues: ['active', 'inactive', 'pending'] },
          ],
        },
        count: 2,
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('validateResponse', () => {
    it('should validate response against expected behavior', async () => {
      const mockValidation = {
        isValid: true,
        confidence: 0.95,
        issues: [],
        suggestions: [],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockValidation) }],
        }),
      } as Response);

      const result = await aiService.validateResponse({
        response: { status: 200, data: { user: { id: 1, name: 'John' } } },
        intent: 'Verify user data is returned',
        expectedBehavior: 'Response should contain user object with id and name',
      });

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect validation issues', async () => {
      const mockValidation = {
        isValid: false,
        confidence: 0.9,
        issues: [
          { severity: 'error', message: 'Missing required field: email', path: 'data.user' },
        ],
        suggestions: ['Add email field to user object'],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockValidation) }],
        }),
      } as Response);

      const result = await aiService.validateResponse({
        response: { status: 200, data: { user: { id: 1, name: 'John' } } },
        intent: 'Verify complete user data',
        expectedBehavior: 'Response should contain user with id, name, and email',
        rules: ['email field is required'],
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('error');
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies in metrics', async () => {
      const mockResult = {
        anomalies: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            metric: 'response_time',
            value: 5000,
            expectedRange: [100, 500],
            severity: 'high',
            description: 'Response time spike detected',
          },
        ],
        baseline: {
          response_time: { mean: 200, stdDev: 50, min: 100, max: 500, percentiles: { p95: 350 } },
        },
        confidence: 0.85,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockResult) }],
        }),
      } as Response);

      const result = await aiService.detectAnomalies({
        metrics: [
          { timestamp: '2024-01-15T10:00:00Z', name: 'response_time', value: 200 },
          { timestamp: '2024-01-15T10:15:00Z', name: 'response_time', value: 210 },
          { timestamp: '2024-01-15T10:30:00Z', name: 'response_time', value: 5000 },
        ],
        sensitivity: 'medium',
      });

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].severity).toBe('high');
    });
  });
});

describe('AI Node Types', () => {
  it('should support ai-test-generator node', () => {
    const config = {
      type: 'ai-test-generator',
      intent: 'Generate API tests for user registration',
      targetLanguage: 'typescript',
      context: {
        apiSpec: '{"openapi": "3.0.0"}',
      },
      generateAssertions: true,
      generateDataVariations: true,
      coverageGoals: ['happy-path', 'error-handling'],
    };

    expect(config.type).toBe('ai-test-generator');
    expect(config.coverageGoals).toContain('happy-path');
  });

  it('should support ai-data-generator node', () => {
    const config = {
      type: 'ai-data-generator',
      intent: 'Generate realistic user profiles',
      schema: {
        fields: [
          { name: 'firstName', type: 'string', aiHint: 'Common first names' },
          { name: 'lastName', type: 'string', aiHint: 'Common last names' },
          { name: 'email', type: 'email' },
        ],
      },
      count: 100,
      locale: 'en-US',
      useRAG: true,
    };

    expect(config.type).toBe('ai-data-generator');
    expect(config.useRAG).toBe(true);
  });

  it('should support ai-response-validator node', () => {
    const config = {
      type: 'ai-response-validator',
      intent: 'Verify the API response contains valid order data',
      expectedBehavior: 'Order should have items, total, and status',
      validationRules: [
        'Total should match sum of item prices',
        'Status should be valid enum',
      ],
      strictMode: true,
      confidenceThreshold: 0.8,
    };

    expect(config.type).toBe('ai-response-validator');
    expect(config.confidenceThreshold).toBe(0.8);
  });

  it('should support ai-anomaly-detector node', () => {
    const config = {
      type: 'ai-anomaly-detector',
      monitoredMetrics: ['response_time', 'error_rate', 'throughput'],
      sensitivityLevel: 'medium',
      baselineWindow: 100,
      alertOnAnomaly: true,
      autoAdjustThresholds: true,
    };

    expect(config.type).toBe('ai-anomaly-detector');
    expect(config.monitoredMetrics).toHaveLength(3);
  });
});
