/**
 * Mock data for development and testing.
 * This file contains sample test plans and nodes used during development
 * before the backend API is available.
 *
 * @fileoverview Development mock data - remove or disable in production
 */

import { TestPlan, TreeNode } from '../../../shared/models';

/**
 * Sample test plans for development.
 */
export function getMockPlans(): TestPlan[] {
  return [
    {
      id: 'plan-1',
      name: 'API Load Test',
      description: 'Load testing for REST API endpoints',
      rootNodeId: 'root-1',
      variables: [
        {
          id: 'var-1',
          name: 'BASE_URL',
          type: 'string',
          scope: 'plan',
          value: 'https://api.example.com',
          sensitive: false,
          description: 'Base URL for API requests'
        },
        {
          id: 'var-2',
          name: 'API_KEY',
          type: 'credentials',
          scope: 'environment',
          value: '',
          sensitive: true,
          description: 'API authentication key'
        }
      ],
      environments: [],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
      createdBy: 'user-1',
      status: 'ready'
    },
    {
      id: 'plan-2',
      name: 'Database Performance',
      description: 'Database query performance tests',
      rootNodeId: 'root-2',
      variables: [],
      environments: [],
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-18'),
      createdBy: 'user-1',
      status: 'draft'
    }
  ];
}

/**
 * Generates mock plan data with nodes for a given plan ID.
 * Creates a realistic test plan structure with thread groups,
 * HTTP requests, assertions, and extractors.
 *
 * @param planId - The plan ID to generate data for
 * @returns Plan and nodes for the mock test plan
 */
export function getMockPlanData(planId: string): { plan: TestPlan; nodes: TreeNode[] } {
  const plans = getMockPlans();
  const foundPlan = plans.find((p) => p.id === planId);
  const rootId = foundPlan?.rootNodeId ?? `root-${planId}`;

  const plan = foundPlan ?? {
    id: planId,
    name: 'New Test Plan',
    description: '',
    rootNodeId: rootId,
    variables: [],
    environments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    status: 'draft' as const
  };

  const nodes: TreeNode[] = [
    // Root node
    {
      id: rootId,
      testPlanId: planId,
      parentId: null,
      type: 'root',
      name: plan.name,
      order: 0,
      enabled: true,
      config: {
        description: '',
        timeout: 30000,
        retryCount: 0,
        continueOnError: false
      },
      generatedCode: null,
      validationStatus: 'pending',
      children: [`tg-${planId}`],
      expanded: true
    },
    // Thread Group
    {
      id: `tg-${planId}`,
      testPlanId: planId,
      parentId: rootId,
      type: 'thread-group',
      name: 'User Threads',
      order: 0,
      enabled: true,
      config: {
        description: 'Simulate concurrent users',
        timeout: 30000,
        retryCount: 0,
        continueOnError: false,
        numThreads: 10,
        rampUp: 5,
        loops: 100,
        scheduler: false,
        duration: 0,
        delay: 0
      },
      generatedCode: null,
      validationStatus: 'pending',
      children: [`http-1-${planId}`, `http-2-${planId}`],
      expanded: true
    },
    // HTTP Request - GET
    {
      id: `http-1-${planId}`,
      testPlanId: planId,
      parentId: `tg-${planId}`,
      type: 'http-request',
      name: 'GET /api/users',
      order: 0,
      enabled: true,
      config: {
        description: 'Fetch all users',
        timeout: 10000,
        retryCount: 2,
        continueOnError: false,
        method: 'GET',
        protocol: 'https',
        serverName: 'api.example.com',
        port: 443,
        path: '/api/users',
        contentEncoding: 'UTF-8',
        followRedirects: true,
        useKeepalive: true,
        bodyData: '',
        headers: { Accept: 'application/json' },
        parameters: []
      },
      generatedCode: null,
      validationStatus: 'valid',
      children: [`assertion-1-${planId}`, `extractor-1-${planId}`],
      expanded: true
    },
    // Response Assertion
    {
      id: `assertion-1-${planId}`,
      testPlanId: planId,
      parentId: `http-1-${planId}`,
      type: 'response-assertion',
      name: 'Check Status 200',
      order: 0,
      enabled: true,
      config: {
        description: 'Verify successful response',
        timeout: 1000,
        retryCount: 0,
        continueOnError: false,
        testField: 'response-code',
        testType: 'equals',
        testStrings: ['200'],
        negation: false,
        assumeSuccess: false
      },
      generatedCode: null,
      validationStatus: 'valid',
      children: [],
      expanded: false
    },
    // JSON Extractor
    {
      id: `extractor-1-${planId}`,
      testPlanId: planId,
      parentId: `http-1-${planId}`,
      type: 'json-extractor',
      name: 'Extract User IDs',
      order: 1,
      enabled: true,
      config: {
        description: 'Extract user IDs from response',
        timeout: 1000,
        retryCount: 0,
        continueOnError: false,
        refName: 'userIds',
        expression: '$..id',
        matchNumber: -1,
        defaultValue: ''
      },
      generatedCode: null,
      validationStatus: 'pending',
      children: [],
      expanded: false
    },
    // HTTP Request - POST
    {
      id: `http-2-${planId}`,
      testPlanId: planId,
      parentId: `tg-${planId}`,
      type: 'http-request',
      name: 'POST /api/users',
      order: 1,
      enabled: true,
      config: {
        description: 'Create a new user',
        timeout: 10000,
        retryCount: 1,
        continueOnError: false,
        method: 'POST',
        protocol: 'https',
        serverName: 'api.example.com',
        port: 443,
        path: '/api/users',
        contentEncoding: 'UTF-8',
        followRedirects: false,
        useKeepalive: true,
        bodyData: '{"name": "Test User", "email": "test@example.com"}',
        headers: { 'Content-Type': 'application/json' },
        parameters: []
      },
      generatedCode: null,
      validationStatus: 'warning',
      children: [],
      expanded: false
    }
  ];

  return { plan, nodes };
}
