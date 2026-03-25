/**
 * TestCraftAI - Comprehensive Test Suite Entry Point
 * Runs all node type tests with full coverage
 */

import { TestRunner, type TestSuiteConfig, type TestSuiteResult } from './test-runner';
import samplerTests from './test-cases/sampler-tests';
import controllerTimerTests from './test-cases/controller-tests';
import assertionExtractorTests from './test-cases/assertion-extractor-tests';
import containerTests from './test-cases/container-tests';
import databaseTests from './test-cases/database-tests';
import variableSubstitutionTests from './test-cases/variable-substitution-tests';
import threadGroupTests from './test-cases/thread-group-tests';
import configElementTests from './test-cases/config-element-tests';
import processorTests from './test-cases/preprocessor-postprocessor-tests';
import moreAssertionTests from './test-cases/more-assertion-tests';
import moreControllerTests from './test-cases/more-controller-tests';
import listenerTests from './test-cases/listener-tests';
import moreSamplerTests from './test-cases/more-sampler-tests';
import aiNodeTests from './test-cases/ai-node-tests';
import chainingTests from './test-cases/chaining-tests';
import globalVariableFlowTests from './test-cases/global-variable-flow-tests';

// All test cases combined
const allTests = [
  ...samplerTests,
  ...controllerTimerTests,
  ...assertionExtractorTests,
  ...containerTests,
  ...databaseTests,
  ...variableSubstitutionTests,
  ...threadGroupTests,
  ...configElementTests,
  ...processorTests,
  ...moreAssertionTests,
  ...moreControllerTests,
  ...listenerTests,
  ...moreSamplerTests,
  ...aiNodeTests,
  ...chainingTests,
  ...globalVariableFlowTests,
];

// Test suite configurations
const suiteConfigs: Record<string, TestSuiteConfig> = {
  smoke: {
    name: 'Smoke Tests',
    description: 'Quick validation of core functionality',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 0,
    retryDelay: 1000,
    timeout: 30000,
    environment: {},
    filter: {
      tags: ['smoke', 'basic'],
    },
  },

  samplers: {
    name: 'Sampler Tests',
    description: 'Tests for all sampler node types (HTTP, JDBC, GraphQL, etc.)',
    parallel: true,
    maxConcurrency: 5,
    retryCount: 2,
    retryDelay: 2000,
    timeout: 60000,
    environment: {},
    filter: {
      categories: ['samplers'],
    },
  },

  controllers: {
    name: 'Controller Tests',
    description: 'Tests for logic controller nodes',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 1,
    retryDelay: 1000,
    timeout: 30000,
    environment: {},
    filter: {
      categories: ['controllers'],
    },
  },

  timers: {
    name: 'Timer Tests',
    description: 'Tests for timer node types',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 1,
    retryDelay: 1000,
    timeout: 60000,
    environment: {},
    filter: {
      categories: ['timers'],
    },
  },

  assertions: {
    name: 'Assertion Tests',
    description: 'Tests for assertion node types',
    parallel: true,
    maxConcurrency: 5,
    retryCount: 1,
    retryDelay: 1000,
    timeout: 30000,
    environment: {},
    filter: {
      categories: ['assertions'],
    },
  },

  extractors: {
    name: 'Extractor Tests',
    description: 'Tests for extractor/post-processor node types',
    parallel: true,
    maxConcurrency: 5,
    retryCount: 1,
    retryDelay: 1000,
    timeout: 30000,
    environment: {},
    filter: {
      categories: ['postprocessors'],
    },
  },

  containers: {
    name: 'Container Tests',
    description: 'Tests for Docker and Kubernetes container operations',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 1,
    retryDelay: 5000,
    timeout: 180000,
    environment: {},
    filter: {
      categories: ['containers'],
    },
  },

  database: {
    name: 'Database Tests',
    description: 'Tests for YugabyteDB/PostgreSQL database operations',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 1,
    retryDelay: 2000,
    timeout: 30000,
    environment: {},
    filter: {
      categories: ['database'],
    },
  },

  variables: {
    name: 'Variable Substitution Tests',
    description: 'Tests for context variable substitution in configs',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 1,
    retryDelay: 1000,
    timeout: 30000,
    environment: {},
    filter: {
      categories: ['variables'],
    },
  },

  chaining: {
    name: 'Node Chaining Tests',
    description: 'Tests for multi-node scenarios (e.g., PostgreSQL container → query)',
    parallel: false,
    maxConcurrency: 1,
    retryCount: 1,
    retryDelay: 5000,
    timeout: 300000, // 5 minutes for container startup
    environment: {},
    filter: {
      categories: ['chaining'],
    },
  },

  full: {
    name: 'Full Test Suite',
    description: 'Complete test coverage for all node types',
    parallel: true,
    maxConcurrency: 10,
    retryCount: 2,
    retryDelay: 3000,
    timeout: 120000,
    environment: {},
  },

  http: {
    name: 'HTTP Tests Only',
    description: 'All HTTP request related tests',
    parallel: true,
    maxConcurrency: 5,
    retryCount: 2,
    retryDelay: 2000,
    timeout: 60000,
    environment: {},
    filter: {
      tags: ['http'],
    },
  },
};

async function runTestSuite(suiteName: string, baseUrl?: string): Promise<TestSuiteResult> {
  const config = suiteConfigs[suiteName];
  if (!config) {
    throw new Error(`Unknown test suite: ${suiteName}. Available: ${Object.keys(suiteConfigs).join(', ')}`);
  }

  const runner = new TestRunner(config, baseUrl);
  runner.registerTests(allTests);

  console.log('\n' + '='.repeat(70));
  console.log(`  TestCraftAI - ${config.name}`);
  console.log(`  ${config.description}`);
  console.log('='.repeat(70) + '\n');

  const result = await runner.runAll();

  // Print summary
  printSummary(result);

  return result;
}

function printSummary(result: TestSuiteResult): void {
  console.log('\n' + '='.repeat(70));
  console.log('  TEST SUITE SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Suite:    ${result.name}`);
  console.log(`  Status:   ${getStatusIcon(result.status)} ${result.status.toUpperCase()}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log('');
  console.log('  Results:');
  console.log(`    Total:   ${result.totalTests}`);
  console.log(`    Passed:  ${result.passed} (\u2714)`);
  console.log(`    Failed:  ${result.failed} (\u2718)`);
  console.log(`    Skipped: ${result.skipped} (\u26A0)`);
  console.log(`    Errors:  ${result.errors}`);
  console.log('');
  console.log('  Coverage:');
  console.log(`    Node Types: ${result.coverage.nodeTypes.covered}/${result.coverage.nodeTypes.total} (${result.coverage.nodeTypes.percentage}%)`);

  if (result.coverage.nodeTypes.missing.length > 0 && result.coverage.nodeTypes.missing.length <= 10) {
    console.log(`    Missing: ${result.coverage.nodeTypes.missing.join(', ')}`);
  } else if (result.coverage.nodeTypes.missing.length > 10) {
    console.log(`    Missing: ${result.coverage.nodeTypes.missing.length} node types`);
  }

  console.log('='.repeat(70) + '\n');

  // Print failed tests
  const failed = result.results.filter(r => r.status === 'failed' || r.status === 'error');
  if (failed.length > 0) {
    console.log('\n  FAILED TESTS:');
    console.log('-'.repeat(70));
    failed.forEach(test => {
      console.log(`  \u2718 ${test.testName}`);
      console.log(`    Node Type: ${test.nodeType}`);
      console.log(`    Error: ${test.error}`);
      console.log('');
    });
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'passed': return '\u2714';
    case 'failed': return '\u2718';
    case 'partial': return '\u26A0';
    default: return '\u2022';
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const suiteName = args[0] || 'smoke';
  const baseUrl = args[1] || process.env.API_URL || 'http://localhost:3000/api/v1';

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TestCraftAI Test Runner

Usage: npm run test:nodes [suite] [baseUrl]

Available suites:
  smoke       - Quick validation of core functionality
  samplers    - Tests for sampler nodes (HTTP, JDBC, etc.)
  controllers - Tests for logic controllers
  timers      - Tests for timer nodes
  assertions  - Tests for assertion nodes
  extractors  - Tests for extractor nodes
  http        - HTTP request tests only
  full        - Complete test coverage

Examples:
  npm run test:nodes smoke
  npm run test:nodes full http://testcraft.local/api/v1
  npm run test:nodes http

Environment Variables:
  API_URL - Base URL for the API (default: http://localhost:3000/api/v1)
`);
    process.exit(0);
  }

  if (args.includes('--list')) {
    console.log('\nAvailable test suites:\n');
    Object.entries(suiteConfigs).forEach(([name, config]) => {
      console.log(`  ${name.padEnd(15)} - ${config.description}`);
    });
    console.log(`\nTotal tests: ${allTests.length}`);
    process.exit(0);
  }

  try {
    const result = await runTestSuite(suiteName, baseUrl);
    process.exit(result.status === 'passed' ? 0 : 1);
  } catch (error) {
    console.error('Test run failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { runTestSuite, allTests, suiteConfigs };

// Run if called directly
main().catch(console.error);
