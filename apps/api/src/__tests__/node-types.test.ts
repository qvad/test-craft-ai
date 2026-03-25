/**
 * Tests for Node Type Definitions
 * Validates all JMeter-equivalent and AI node types
 */

import { describe, it, expect } from 'vitest';
import { NODE_CATEGORIES } from '../../packages/shared-types/src/nodes.js';

describe('Node Types', () => {
  describe('NODE_CATEGORIES', () => {
    it('should have all required categories', () => {
      const expectedCategories = [
        'core',
        'samplers',
        'controllers',
        'timers',
        'preprocessors',
        'postprocessors',
        'assertions',
        'config',
        'listeners',
        'ai',
      ];

      expectedCategories.forEach((category) => {
        expect(NODE_CATEGORIES).toHaveProperty(category);
        expect(Array.isArray(NODE_CATEGORIES[category as keyof typeof NODE_CATEGORIES])).toBe(true);
      });
    });

    it('should have core node types', () => {
      expect(NODE_CATEGORIES.core).toContain('root');
      expect(NODE_CATEGORIES.core).toContain('thread-group');
      expect(NODE_CATEGORIES.core).toContain('setup-thread-group');
      expect(NODE_CATEGORIES.core).toContain('teardown-thread-group');
    });

    it('should have JMeter-equivalent samplers', () => {
      const expectedSamplers = [
        'http-request',
        'jdbc-request',
        'tcp-sampler',
        'smtp-sampler',
        'ftp-request',
        'graphql-request',
        'websocket-request',
      ];

      expectedSamplers.forEach((sampler) => {
        expect(NODE_CATEGORIES.samplers).toContain(sampler);
      });
    });

    it('should have modern protocol samplers', () => {
      expect(NODE_CATEGORIES.samplers).toContain('grpc-request');
      expect(NODE_CATEGORIES.samplers).toContain('kafka-producer');
      expect(NODE_CATEGORIES.samplers).toContain('kafka-consumer');
      expect(NODE_CATEGORIES.samplers).toContain('mongodb-request');
      expect(NODE_CATEGORIES.samplers).toContain('redis-request');
    });

    it('should have JMeter-equivalent controllers', () => {
      const expectedControllers = [
        'loop-controller',
        'while-controller',
        'foreach-controller',
        'if-controller',
        'switch-controller',
        'transaction-controller',
        'throughput-controller',
        'once-only-controller',
      ];

      expectedControllers.forEach((controller) => {
        expect(NODE_CATEGORIES.controllers).toContain(controller);
      });
    });

    it('should have parallel controller for modern needs', () => {
      expect(NODE_CATEGORIES.controllers).toContain('parallel-controller');
    });

    it('should have JMeter-equivalent timers', () => {
      const expectedTimers = [
        'constant-timer',
        'uniform-random-timer',
        'gaussian-random-timer',
        'poisson-random-timer',
        'constant-throughput-timer',
        'synchronizing-timer',
      ];

      expectedTimers.forEach((timer) => {
        expect(NODE_CATEGORIES.timers).toContain(timer);
      });
    });

    it('should have JMeter-equivalent extractors', () => {
      const expectedExtractors = [
        'regex-extractor',
        'json-extractor',
        'xpath-extractor',
        'css-extractor',
        'boundary-extractor',
      ];

      expectedExtractors.forEach((extractor) => {
        expect(NODE_CATEGORIES.postprocessors).toContain(extractor);
      });
    });

    it('should have JMeter-equivalent assertions', () => {
      const expectedAssertions = [
        'response-assertion',
        'json-assertion',
        'xpath-assertion',
        'duration-assertion',
        'size-assertion',
      ];

      expectedAssertions.forEach((assertion) => {
        expect(NODE_CATEGORIES.assertions).toContain(assertion);
      });
    });

    it('should have JSON Schema assertion', () => {
      expect(NODE_CATEGORIES.assertions).toContain('json-schema-assertion');
    });

    it('should have JMeter-equivalent config elements', () => {
      const expectedConfigs = [
        'csv-data-set',
        'http-request-defaults',
        'http-header-manager',
        'http-cookie-manager',
        'jdbc-connection-config',
        'counter',
        'random-variable',
        'user-defined-variables',
      ];

      expectedConfigs.forEach((config) => {
        expect(NODE_CATEGORIES.config).toContain(config);
      });
    });

    it('should have AI-powered nodes', () => {
      const expectedAINodes = [
        'ai-test-generator',
        'ai-data-generator',
        'ai-response-validator',
        'ai-load-predictor',
        'ai-anomaly-detector',
        'ai-scenario-builder',
        'ai-assertion',
        'ai-extractor',
        'ai-script',
      ];

      expectedAINodes.forEach((aiNode) => {
        expect(NODE_CATEGORIES.ai).toContain(aiNode);
      });
    });
  });

  describe('Sampler Count', () => {
    it('should have at least 15 sampler types', () => {
      expect(NODE_CATEGORIES.samplers.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Controller Count', () => {
    it('should have at least 10 controller types', () => {
      expect(NODE_CATEGORIES.controllers.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('AI Node Count', () => {
    it('should have at least 8 AI node types', () => {
      expect(NODE_CATEGORIES.ai.length).toBeGreaterThanOrEqual(8);
    });
  });
});

describe('JMeter Parity', () => {
  it('should cover main JMeter test elements', () => {
    // Thread Groups
    expect(NODE_CATEGORIES.core).toContain('thread-group');

    // Samplers
    expect(NODE_CATEGORIES.samplers).toContain('http-request');
    expect(NODE_CATEGORIES.samplers).toContain('jdbc-request');

    // Logic Controllers
    expect(NODE_CATEGORIES.controllers).toContain('loop-controller');
    expect(NODE_CATEGORIES.controllers).toContain('if-controller');
    expect(NODE_CATEGORIES.controllers).toContain('while-controller');

    // Timers
    expect(NODE_CATEGORIES.timers).toContain('constant-timer');

    // Assertions
    expect(NODE_CATEGORIES.assertions).toContain('response-assertion');

    // Config Elements
    expect(NODE_CATEGORIES.config).toContain('csv-data-set');
    expect(NODE_CATEGORIES.config).toContain('http-header-manager');

    // Listeners
    expect(NODE_CATEGORIES.listeners).toContain('view-results-tree');
    expect(NODE_CATEGORIES.listeners).toContain('summary-report');
  });
});

describe('Modern Extensions', () => {
  it('should have GraphQL support', () => {
    expect(NODE_CATEGORIES.samplers).toContain('graphql-request');
  });

  it('should have gRPC support', () => {
    expect(NODE_CATEGORIES.samplers).toContain('grpc-request');
  });

  it('should have WebSocket support', () => {
    expect(NODE_CATEGORIES.samplers).toContain('websocket-request');
  });

  it('should have Kafka support', () => {
    expect(NODE_CATEGORIES.samplers).toContain('kafka-producer');
    expect(NODE_CATEGORIES.samplers).toContain('kafka-consumer');
  });

  it('should have NoSQL database support', () => {
    expect(NODE_CATEGORIES.samplers).toContain('mongodb-request');
    expect(NODE_CATEGORIES.samplers).toContain('redis-request');
  });

  it('should have AI-powered test generation', () => {
    expect(NODE_CATEGORIES.ai).toContain('ai-test-generator');
    expect(NODE_CATEGORIES.ai).toContain('ai-scenario-builder');
  });

  it('should have AI-powered data generation', () => {
    expect(NODE_CATEGORIES.ai).toContain('ai-data-generator');
  });

  it('should have AI-powered validation', () => {
    expect(NODE_CATEGORIES.ai).toContain('ai-response-validator');
    expect(NODE_CATEGORIES.ai).toContain('ai-assertion');
  });

  it('should have AI-powered anomaly detection', () => {
    expect(NODE_CATEGORIES.ai).toContain('ai-anomaly-detector');
  });
});
