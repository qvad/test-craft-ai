/**
 * Listener Test Cases
 * View Results Tree, Summary Report, Aggregate Report, Backend Listener, Simple Data Writer
 */

import type { TestCase } from '../test-runner';

export const listenerTests: TestCase[] = [
  // VIEW RESULTS TREE
  {
    id: 'view-results-tree',
    name: 'View Results Tree - Basic',
    description: 'Test view results tree listener',
    nodeType: 'view-results-tree',
    category: 'listeners',
    config: {
      type: 'view-results-tree',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.type === 'view-results-tree' &&
        result.output?.enabled === true,
    },
    timeout: 5000,
    tags: ['listener', 'results'],
  },

  // SUMMARY REPORT
  {
    id: 'summary-report',
    name: 'Summary Report - Basic',
    description: 'Test summary report listener',
    nodeType: 'summary-report',
    category: 'listeners',
    config: {
      type: 'summary-report',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.type === 'summary-report' &&
        result.output?.enabled === true,
    },
    timeout: 5000,
    tags: ['listener', 'report'],
  },

  // AGGREGATE REPORT
  {
    id: 'aggregate-report',
    name: 'Aggregate Report - Basic',
    description: 'Test aggregate report listener',
    nodeType: 'aggregate-report',
    category: 'listeners',
    config: {
      type: 'aggregate-report',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.type === 'aggregate-report' &&
        result.output?.enabled === true,
    },
    timeout: 5000,
    tags: ['listener', 'aggregate'],
  },

  // BACKEND LISTENER
  {
    id: 'backend-listener-influxdb',
    name: 'Backend Listener - InfluxDB',
    description: 'Test backend listener with InfluxDB backend',
    nodeType: 'backend-listener',
    category: 'listeners',
    config: {
      type: 'backend-listener',
      backendClass: 'org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient',
      asyncQueueSize: 5000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.asyncQueueSize === 5000 &&
        result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['listener', 'backend', 'influxdb'],
  },

  // SIMPLE DATA WRITER
  {
    id: 'simple-data-writer',
    name: 'Simple Data Writer - Basic',
    description: 'Test simple data writer listener',
    nodeType: 'simple-data-writer',
    category: 'listeners',
    config: {
      type: 'simple-data-writer',
      filename: '/results/output.jtl',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.filename === '/results/output.jtl' &&
        result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['listener', 'writer'],
  },
];

export default listenerTests;
