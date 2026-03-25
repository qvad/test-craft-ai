/**
 * AI Node Test Cases
 * Test Generator, Data Generator, Response Validator, Load Predictor,
 * Anomaly Detector, Scenario Builder, AI Assertion, AI Extractor, AI Script
 */

import type { TestCase } from '../test-runner';

export const aiNodeTests: TestCase[] = [
  // AI TEST GENERATOR
  {
    id: 'ai-test-generator',
    name: 'AI Test Generator - Basic',
    description: 'Test AI-powered test generation',
    nodeType: 'ai-test-generator',
    category: 'ai',
    config: {
      type: 'ai-test-generator',
      intent: 'Test user login with valid credentials',
      targetNodeType: 'http-request',
      context: { baseUrl: 'https://api.example.com' },
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.generated === true,
    },
    timeout: 10000,
    tags: ['ai', 'generator', 'test'],
  },

  // AI DATA GENERATOR
  {
    id: 'ai-data-generator-users',
    name: 'AI Data Generator - Users',
    description: 'Test AI-powered data generation for users',
    nodeType: 'ai-data-generator',
    category: 'ai',
    config: {
      type: 'ai-data-generator',
      schema: {
        fields: [
          { name: 'username', type: 'string' },
          { name: 'email', type: 'email' },
          { name: 'age', type: 'number', min: 18, max: 65 },
        ],
      },
      count: 5,
      locale: 'en',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.count === 5 &&
        result.output?.data?.length === 5,
    },
    timeout: 10000,
    tags: ['ai', 'generator', 'data'],
  },

  // AI RESPONSE VALIDATOR
  {
    id: 'ai-response-validator',
    name: 'AI Response Validator - Basic',
    description: 'Test AI-powered response validation',
    nodeType: 'ai-response-validator',
    category: 'ai',
    config: {
      type: 'ai-response-validator',
      intent: 'Verify successful user creation',
      expectedBehavior: 'Should return 201 status with user ID',
      rules: ['Response must contain user ID', 'Status must be success'],
    },
    inputs: {
      response: {
        statusCode: 201,
        body: '{"id": 123, "status": "created"}',
      },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.validated === true &&
        result.output?.confidence > 0.8,
    },
    timeout: 10000,
    tags: ['ai', 'validator', 'response'],
  },

  // AI LOAD PREDICTOR
  {
    id: 'ai-load-predictor',
    name: 'AI Load Predictor - Basic',
    description: 'Test AI-powered load prediction',
    nodeType: 'ai-load-predictor',
    category: 'ai',
    config: {
      type: 'ai-load-predictor',
      historicalData: [100, 150, 200, 180, 220],
      targetMetric: 'requests_per_second',
      predictionWindow: '1h',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.prediction?.expectedLoad > 0 &&
        result.output?.prediction?.confidence > 0,
    },
    timeout: 10000,
    tags: ['ai', 'predictor', 'load'],
  },

  // AI ANOMALY DETECTOR
  {
    id: 'ai-anomaly-detector',
    name: 'AI Anomaly Detector - Basic',
    description: 'Test AI-powered anomaly detection',
    nodeType: 'ai-anomaly-detector',
    category: 'ai',
    config: {
      type: 'ai-anomaly-detector',
      metrics: ['response_time', 'error_rate', 'throughput'],
      threshold: 0.95,
      sensitivity: 'medium',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.status === 'normal' &&
        result.output?.metricsAnalyzed === 3,
    },
    timeout: 10000,
    tags: ['ai', 'detector', 'anomaly'],
  },

  // AI SCENARIO BUILDER
  {
    id: 'ai-scenario-builder',
    name: 'AI Scenario Builder - Basic',
    description: 'Test AI-powered scenario building',
    nodeType: 'ai-scenario-builder',
    category: 'ai',
    config: {
      type: 'ai-scenario-builder',
      description: 'E-commerce checkout flow with payment processing',
      constraints: {
        maxSteps: 10,
        includeAuth: true,
      },
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.built === true &&
        result.output?.scenario?.steps > 0,
    },
    timeout: 10000,
    tags: ['ai', 'builder', 'scenario'],
  },

  // AI ASSERTION
  {
    id: 'ai-assertion-pass',
    name: 'AI Assertion - Pass',
    description: 'Test AI-powered assertion that passes',
    nodeType: 'ai-assertion',
    category: 'ai',
    config: {
      type: 'ai-assertion',
      intent: 'Verify API returns valid JSON with user data',
      expectedOutcome: 'Response contains user object with id and name',
    },
    inputs: {
      response: {
        body: '{"user": {"id": 1, "name": "John"}}',
      },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.passed === true &&
        result.output?.confidence > 0.8,
    },
    timeout: 10000,
    tags: ['ai', 'assertion'],
  },

  // AI EXTRACTOR
  {
    id: 'ai-extractor-basic',
    name: 'AI Extractor - Basic',
    description: 'Test AI-powered value extraction',
    nodeType: 'ai-extractor',
    category: 'ai',
    config: {
      type: 'ai-extractor',
      variableName: 'userId',
      extractionIntent: 'Extract user ID from response',
    },
    inputs: {
      response: {
        body: '{"user": {"id": 12345, "name": "John"}}',
      },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.extractedValues?.userId !== undefined,
    },
    timeout: 10000,
    tags: ['ai', 'extractor'],
  },

  // AI SCRIPT
  {
    id: 'ai-script-javascript',
    name: 'AI Script - JavaScript',
    description: 'Test AI-powered script generation',
    nodeType: 'ai-script',
    category: 'ai',
    config: {
      type: 'ai-script',
      intent: 'Generate random string for password',
      targetLanguage: 'javascript',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.generated === true &&
        result.output?.script?.length > 0,
    },
    timeout: 10000,
    tags: ['ai', 'script'],
  },
];

export default aiNodeTests;
