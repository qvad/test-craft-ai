/**
 * TestCraftAI - Comprehensive Node Testing Framework
 * Autonomous test execution with full coverage for all node types
 */

import type { NodeType, NodeConfig } from '@testcraft/shared-types';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  nodeType: NodeType;
  category: string;
  config: Partial<NodeConfig>;
  inputs: Record<string, unknown>;
  expectedOutput: ExpectedOutput;
  timeout: number;
  tags: string[];
  dependsOn?: string[];
  skip?: boolean; // Skip this test (e.g., if Docker/K8s not available)
}

export interface ExpectedOutput {
  status: 'success' | 'error' | 'timeout';
  statusCodes?: number[];
  outputContains?: string[];
  outputNotContains?: string[];
  outputMatches?: RegExp[];
  responseTimeMs?: { min?: number; max?: number };
  extractedValues?: Record<string, unknown>;
  errorContains?: string[];
  customValidator?: (result: TestResult) => boolean;
}

export interface TestResult {
  testId: string;
  testName: string;
  nodeType: NodeType;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  actualOutput: unknown;
  expectedOutput: ExpectedOutput;
  error?: string;
  logs: LogEntry[];
  metrics: TestMetrics;
  timestamp: Date;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TestMetrics {
  requestCount: number;
  bytesReceived: number;
  bytesSent: number;
  latencyMs: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface TestSuiteConfig {
  name: string;
  description: string;
  parallel: boolean;
  maxConcurrency: number;
  retryCount: number;
  retryDelay: number;
  timeout: number;
  environment: Record<string, string>;
  tags?: string[];
  filter?: {
    nodeTypes?: NodeType[];
    categories?: string[];
    tags?: string[];
  };
}

export interface TestSuiteResult {
  name: string;
  status: 'passed' | 'failed' | 'partial';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  results: TestResult[];
  coverage: CoverageReport;
  timestamp: Date;
}

export interface CoverageReport {
  nodeTypes: {
    total: number;
    covered: number;
    percentage: number;
    missing: NodeType[];
  };
  categories: Record<string, { covered: number; total: number }>;
  parameters: {
    total: number;
    covered: number;
    percentage: number;
  };
}

export class TestRunner {
  private tests: Map<string, TestCase> = new Map();
  private results: TestResult[] = [];
  private config: TestSuiteConfig;
  private baseUrl: string;

  constructor(config: TestSuiteConfig, baseUrl = 'http://localhost:3000/api/v1') {
    this.config = config;
    this.baseUrl = baseUrl;
  }

  registerTest(test: TestCase): void {
    this.tests.set(test.id, test);
  }

  registerTests(tests: TestCase[]): void {
    tests.forEach(test => this.registerTest(test));
  }

  async runAll(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const testsToRun = this.filterTests();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running Test Suite: ${this.config.name}`);
    console.log(`Tests to run: ${testsToRun.length}`);
    console.log(`${'='.repeat(60)}\n`);

    if (this.config.parallel) {
      await this.runParallel(testsToRun);
    } else {
      await this.runSequential(testsToRun);
    }

    return this.generateReport(startTime);
  }

  private filterTests(): TestCase[] {
    let tests = Array.from(this.tests.values());
    const filter = this.config.filter;

    if (filter?.nodeTypes?.length) {
      tests = tests.filter(t => filter.nodeTypes!.includes(t.nodeType));
    }

    if (filter?.categories?.length) {
      tests = tests.filter(t => filter.categories!.includes(t.category));
    }

    if (filter?.tags?.length) {
      tests = tests.filter(t => t.tags.some(tag => filter.tags!.includes(tag)));
    }

    // Sort by dependencies
    return this.sortByDependencies(tests);
  }

  private sortByDependencies(tests: TestCase[]): TestCase[] {
    const sorted: TestCase[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (test: TestCase) => {
      if (visited.has(test.id)) return;
      if (visiting.has(test.id)) {
        throw new Error(`Circular dependency detected: ${test.id}`);
      }

      visiting.add(test.id);

      if (test.dependsOn) {
        for (const depId of test.dependsOn) {
          const dep = this.tests.get(depId);
          if (dep) visit(dep);
        }
      }

      visiting.delete(test.id);
      visited.add(test.id);
      sorted.push(test);
    };

    tests.forEach(visit);
    return sorted;
  }

  private async runSequential(tests: TestCase[]): Promise<void> {
    for (const test of tests) {
      const result = await this.runTest(test);
      this.results.push(result);
      this.logResult(result);
    }
  }

  private async runParallel(tests: TestCase[]): Promise<void> {
    const chunks = this.chunkArray(tests, this.config.maxConcurrency);

    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(test => this.runTest(test)));
      results.forEach(result => {
        this.results.push(result);
        this.logResult(result);
      });
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async runTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const logs: LogEntry[] = [];

    const log = (level: LogEntry['level'], message: string, metadata?: Record<string, unknown>) => {
      logs.push({ level, message, timestamp: new Date(), metadata });
    };

    log('info', `Starting test: ${test.name}`);

    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= this.config.retryCount) {
      try {
        const result = await this.executeTest(test, log);
        const duration = Date.now() - startTime;

        const passed = this.validateResult(result, test.expectedOutput);

        return {
          testId: test.id,
          testName: test.name,
          nodeType: test.nodeType,
          status: passed ? 'passed' : 'failed',
          duration,
          actualOutput: result,
          expectedOutput: test.expectedOutput,
          error: passed ? undefined : 'Validation failed',
          logs,
          metrics: {
            requestCount: 1,
            bytesReceived: JSON.stringify(result).length,
            bytesSent: JSON.stringify(test.config).length,
            latencyMs: duration,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error as Error;
        retries++;
        if (retries <= this.config.retryCount) {
          log('warn', `Test failed, retrying (${retries}/${this.config.retryCount}): ${lastError.message}`);
          await this.sleep(this.config.retryDelay);
        }
      }
    }

    const duration = Date.now() - startTime;
    log('error', `Test failed after ${retries} retries: ${lastError?.message}`);

    return {
      testId: test.id,
      testName: test.name,
      nodeType: test.nodeType,
      status: 'error',
      duration,
      actualOutput: null,
      expectedOutput: test.expectedOutput,
      error: lastError?.message || 'Unknown error',
      logs,
      metrics: {
        requestCount: retries + 1,
        bytesReceived: 0,
        bytesSent: 0,
        latencyMs: duration,
      },
      timestamp: new Date(),
    };
  }

  private async executeTest(test: TestCase, log: (level: LogEntry['level'], message: string, metadata?: Record<string, unknown>) => void): Promise<unknown> {
    log('debug', `Executing ${test.nodeType} test with config`, { config: test.config });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), test.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/test/node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeType: test.nodeType,
          config: test.config,
          inputs: test.inputs,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();
      log('debug', `Test response received`, { status: response.status, result });

      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validateResult(actual: unknown, expected: ExpectedOutput): boolean {
    const result = actual as Record<string, unknown>;

    // Check status
    if (expected.status && result.status !== expected.status) {
      return false;
    }

    // Check status codes - look in output.statusCode for HTTP responses
    if (expected.statusCodes?.length) {
      const output = result.output as Record<string, unknown> | undefined;
      const statusCode = (output?.statusCode ?? result.statusCode) as number;
      if (!expected.statusCodes.includes(statusCode)) {
        return false;
      }
    }

    // Check output contains - convert output to JSON string for searching
    const outputStr = typeof result.output === 'object'
      ? JSON.stringify(result.output)
      : String(result.output || '');

    if (expected.outputContains?.length) {
      for (const text of expected.outputContains) {
        if (!outputStr.includes(text)) {
          return false;
        }
      }
    }

    // Check output not contains
    if (expected.outputNotContains?.length) {
      for (const text of expected.outputNotContains) {
        if (outputStr.includes(text)) {
          return false;
        }
      }
    }

    // Check output matches regex
    if (expected.outputMatches?.length) {
      for (const regex of expected.outputMatches) {
        if (!regex.test(outputStr)) {
          return false;
        }
      }
    }

    // Check response time
    const duration = result.duration as number;
    if (expected.responseTimeMs) {
      if (expected.responseTimeMs.min !== undefined && duration < expected.responseTimeMs.min) {
        return false;
      }
      if (expected.responseTimeMs.max !== undefined && duration > expected.responseTimeMs.max) {
        return false;
      }
    }

    // Check error contains
    if (expected.errorContains?.length) {
      const error = String(result.error || '');
      for (const text of expected.errorContains) {
        if (!error.includes(text)) {
          return false;
        }
      }
    }

    // Check extracted values
    if (expected.extractedValues) {
      const extracted = result.extractedValues as Record<string, any> | undefined;
      if (!extracted) return false;

      for (const [key, expectedValue] of Object.entries(expected.extractedValues)) {
        const actualValue = extracted[key];
        
        // Use JSON stringify for simple deep comparison
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
          return false;
        }
      }
    }

    // Custom validator
    if (expected.customValidator) {
      return expected.customValidator(result as unknown as TestResult);
    }

    return true;
  }

  private logResult(result: TestResult): void {
    const icon = result.status === 'passed' ? '\u2714' : result.status === 'failed' ? '\u2718' : '\u26A0';
    const color = result.status === 'passed' ? '\x1b[32m' : result.status === 'failed' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${color}${icon} ${result.testName} (${result.nodeType}) - ${result.duration}ms${reset}`);

    if (result.status !== 'passed' && result.error) {
      console.log(`   Error: ${result.error}`);
      // Debug: show actual output for failed tests
      if (process.env.DEBUG_TESTS) {
        console.log(`   Actual output: ${JSON.stringify(result.actualOutput, null, 2)}`);
      }
    }
  }

  private generateReport(startTime: number): TestSuiteResult {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const errors = this.results.filter(r => r.status === 'error').length;

    const coverage = this.calculateCoverage();

    const status = failed === 0 && errors === 0 ? 'passed' : passed > 0 ? 'partial' : 'failed';

    return {
      name: this.config.name,
      status,
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      errors,
      duration: Date.now() - startTime,
      results: this.results,
      coverage,
      timestamp: new Date(),
    };
  }

  private calculateCoverage(): CoverageReport {
    const allNodeTypes: NodeType[] = [
      'root', 'thread-group', 'setup-thread-group', 'teardown-thread-group',
      'http-request', 'jdbc-request', 'jms-publisher', 'jms-subscriber',
      'tcp-sampler', 'smtp-sampler', 'ftp-request', 'ldap-request',
      'graphql-request', 'grpc-request', 'websocket-request',
      'kafka-producer', 'kafka-consumer', 'mongodb-request',
      'yugabyte-request', 'postgresql-request', 'database-request',
      'shell-command', 'script-sampler',
      'docker-run', 'k8s-deploy', 'k8s-pod',
      'loop-controller', 'while-controller', 'foreach-controller', 'if-controller',
      'switch-controller', 'transaction-controller', 'throughput-controller',
      'runtime-controller', 'interleave-controller', 'random-controller',
      'random-order-controller', 'once-only-controller', 'module-controller',
      'include-controller', 'parallel-controller',
      'constant-timer', 'uniform-random-timer', 'gaussian-random-timer',
      'poisson-random-timer', 'constant-throughput-timer', 'precise-throughput-timer',
      'synchronizing-timer',
      'user-parameters', 'html-link-parser', 'http-url-rewriting-modifier',
      'beanshell-preprocessor', 'jsr223-preprocessor',
      'regex-extractor', 'json-extractor', 'xpath-extractor', 'css-extractor',
      'boundary-extractor', 'result-status-handler', 'beanshell-postprocessor',
      'jsr223-postprocessor',
      'response-assertion', 'json-assertion', 'json-schema-assertion',
      'xpath-assertion', 'duration-assertion', 'size-assertion', 'md5hex-assertion',
      'compare-assertion', 'html-assertion', 'xml-assertion',
      'beanshell-assertion', 'jsr223-assertion',
      'csv-data-set', 'http-request-defaults', 'http-header-manager',
      'http-cookie-manager', 'http-cache-manager', 'http-authorization-manager',
      'jdbc-connection-config', 'keystore-config', 'login-config',
      'counter', 'random-variable', 'user-defined-variables', 'dns-cache-manager',
      'view-results-tree', 'summary-report', 'aggregate-report',
      'backend-listener', 'simple-data-writer',
      'ai-test-generator', 'ai-data-generator', 'ai-response-validator',
      'ai-load-predictor', 'ai-anomaly-detector', 'ai-scenario-builder',
      'ai-assertion', 'ai-extractor', 'ai-script'
    ];

    const testedNodeTypes = new Set(this.results.map(r => r.nodeType));
    const missing = allNodeTypes.filter(t => !testedNodeTypes.has(t));

    return {
      nodeTypes: {
        total: allNodeTypes.length,
        covered: testedNodeTypes.size,
        percentage: Math.round((testedNodeTypes.size / allNodeTypes.length) * 100),
        missing,
      },
      categories: {},
      parameters: {
        total: 0,
        covered: 0,
        percentage: 0,
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TestRunner;
