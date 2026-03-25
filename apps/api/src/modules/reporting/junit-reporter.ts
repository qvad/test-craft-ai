/**
 * JUnit XML Reporter
 *
 * Generates JUnit XML reports compatible with:
 * - Jenkins JUnit plugin
 * - GitHub Actions
 * - GitLab CI
 * - Azure DevOps
 * - Most CI/CD systems
 */

import { ExecutionReport, StepResult, AssertionResult } from './types';

export interface JUnitOptions {
  suiteName?: string;
  includeSystemOut?: boolean;
  includeSystemErr?: boolean;
  includeProperties?: boolean;
  hostname?: string;
  packageName?: string;
}

export class JUnitReporter {
  private options: JUnitOptions;

  constructor(options: JUnitOptions = {}) {
    this.options = {
      includeSystemOut: true,
      includeSystemErr: true,
      includeProperties: true,
      hostname: process.env.HOSTNAME || 'localhost',
      ...options,
    };
  }

  /**
   * Generate JUnit XML from execution report
   */
  generate(report: ExecutionReport): string {
    const suites = this.buildTestSuites(report);
    return this.toXml(suites);
  }

  /**
   * Build test suites structure
   */
  private buildTestSuites(report: ExecutionReport): JUnitTestSuites {
    const testCases = this.flattenSteps(report.steps);

    const suite: JUnitTestSuite = {
      name: this.options.suiteName || report.planName,
      tests: testCases.length,
      failures: testCases.filter(tc => tc.failure).length,
      errors: testCases.filter(tc => tc.error).length,
      skipped: testCases.filter(tc => tc.skipped).length,
      time: report.duration / 1000,
      timestamp: report.startTime.toISOString(),
      hostname: this.options.hostname!,
      package: this.options.packageName || 'testcraft',
      properties: this.buildProperties(report),
      testcases: testCases,
      systemOut: this.options.includeSystemOut ? this.buildSystemOut(report) : undefined,
      systemErr: this.options.includeSystemErr ? this.buildSystemErr(report) : undefined,
    };

    return {
      name: report.planName,
      tests: suite.tests,
      failures: suite.failures,
      errors: suite.errors,
      time: suite.time,
      testsuites: [suite],
    };
  }

  /**
   * Flatten nested steps into test cases
   */
  private flattenSteps(steps: StepResult[], parentName = ''): JUnitTestCase[] {
    const cases: JUnitTestCase[] = [];

    for (const step of steps) {
      const fullName = parentName ? `${parentName} > ${step.name}` : step.name;

      // If step has children (transaction controller), recurse
      if (step.children && step.children.length > 0) {
        cases.push(...this.flattenSteps(step.children, fullName));
      } else {
        cases.push(this.stepToTestCase(step, fullName));
      }
    }

    return cases;
  }

  /**
   * Convert a step to a JUnit test case
   */
  private stepToTestCase(step: StepResult, fullName: string): JUnitTestCase {
    const testCase: JUnitTestCase = {
      name: fullName,
      classname: `testcraft.${step.type.replace(/-/g, '_')}`,
      time: (step.duration || 0) / 1000,
      assertions: step.assertions.length,
    };

    // Add failure/error/skipped
    if (step.status === 'failed') {
      const failedAssertion = step.assertions.find(a => !a.passed);
      testCase.failure = {
        message: failedAssertion?.message || step.error?.message || 'Test failed',
        type: failedAssertion?.type || 'AssertionError',
        content: this.buildFailureContent(step, failedAssertion),
      };
    } else if (step.status === 'error') {
      testCase.error = {
        message: step.error?.message || 'Unexpected error',
        type: step.error?.type || 'Error',
        content: step.error?.stack || '',
      };
    } else if (step.status === 'skipped') {
      testCase.skipped = {
        message: 'Test skipped',
      };
    }

    // Add system output (logs)
    if (step.logs && step.logs.length > 0) {
      testCase.systemOut = step.logs
        .filter(l => l.level !== 'error')
        .map(l => `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
        .join('\n');

      testCase.systemErr = step.logs
        .filter(l => l.level === 'error')
        .map(l => `[${l.timestamp.toISOString()}] [ERROR] ${l.message}`)
        .join('\n');
    }

    return testCase;
  }

  /**
   * Build failure content with assertion details
   */
  private buildFailureContent(step: StepResult, assertion?: AssertionResult): string {
    const lines: string[] = [];

    if (assertion) {
      lines.push(`Assertion: ${assertion.name}`);
      if (assertion.expected !== undefined) {
        lines.push(`Expected: ${JSON.stringify(assertion.expected)}`);
      }
      if (assertion.actual !== undefined) {
        lines.push(`Actual: ${JSON.stringify(assertion.actual)}`);
      }
    }

    // Add all failed assertions
    const failedAssertions = step.assertions.filter(a => !a.passed);
    if (failedAssertions.length > 1) {
      lines.push('', 'All Failed Assertions:');
      for (const fa of failedAssertions) {
        lines.push(`  - ${fa.name}: ${fa.message || 'Failed'}`);
      }
    }

    // Add step output if available
    if (step.output) {
      lines.push('', 'Step Output:', step.output.slice(0, 1000));
    }

    return lines.join('\n');
  }

  /**
   * Build properties section
   */
  private buildProperties(report: ExecutionReport): JUnitProperty[] {
    const props: JUnitProperty[] = [
      { name: 'execution.id', value: report.executionId },
      { name: 'plan.name', value: report.planName },
      { name: 'environment', value: report.environment },
    ];

    if (report.planVersion) {
      props.push({ name: 'plan.version', value: report.planVersion });
    }
    if (report.gitCommit) {
      props.push({ name: 'git.commit', value: report.gitCommit });
    }
    if (report.gitBranch) {
      props.push({ name: 'git.branch', value: report.gitBranch });
    }
    if (report.buildNumber) {
      props.push({ name: 'build.number', value: report.buildNumber });
    }

    // Add summary metrics
    props.push(
      { name: 'metrics.total', value: String(report.summary.totalTests) },
      { name: 'metrics.passed', value: String(report.summary.passed) },
      { name: 'metrics.failed', value: String(report.summary.failed) },
      { name: 'metrics.skipped', value: String(report.summary.skipped) },
    );

    if (report.summary.avgResponseTime) {
      props.push({ name: 'metrics.avgResponseTime', value: String(report.summary.avgResponseTime) });
    }

    return props;
  }

  /**
   * Build system-out content
   */
  private buildSystemOut(report: ExecutionReport): string {
    const lines: string[] = [];

    // Add execution info
    lines.push('='.repeat(60));
    lines.push(`TestCraft Execution: ${report.executionId}`);
    lines.push(`Plan: ${report.planName} v${report.planVersion || '1.0'}`);
    lines.push(`Environment: ${report.environment}`);
    lines.push(`Start: ${report.startTime.toISOString()}`);
    lines.push(`End: ${report.endTime.toISOString()}`);
    lines.push(`Duration: ${report.duration}ms`);
    lines.push('='.repeat(60));
    lines.push('');

    // Add logs
    if (report.logs) {
      for (const log of report.logs.filter(l => l.level !== 'error')) {
        lines.push(`[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build system-err content
   */
  private buildSystemErr(report: ExecutionReport): string {
    const lines: string[] = [];

    if (report.logs) {
      for (const log of report.logs.filter(l => l.level === 'error')) {
        lines.push(`[${log.timestamp.toISOString()}] [ERROR] ${log.message}`);
        if (log.data?.stack) {
          lines.push(log.data.stack);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert to XML string
   */
  private toXml(suites: JUnitTestSuites): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
    ];

    // Root element
    lines.push(`<testsuites name="${this.escapeXml(suites.name)}" tests="${suites.tests}" failures="${suites.failures}" errors="${suites.errors}" time="${suites.time.toFixed(3)}">`);

    for (const suite of suites.testsuites) {
      lines.push(`  <testsuite name="${this.escapeXml(suite.name)}" tests="${suite.tests}" failures="${suite.failures}" errors="${suite.errors}" skipped="${suite.skipped}" time="${suite.time.toFixed(3)}" timestamp="${suite.timestamp}" hostname="${this.escapeXml(suite.hostname)}" package="${this.escapeXml(suite.package)}">`);

      // Properties
      if (this.options.includeProperties && suite.properties.length > 0) {
        lines.push('    <properties>');
        for (const prop of suite.properties) {
          lines.push(`      <property name="${this.escapeXml(prop.name)}" value="${this.escapeXml(prop.value)}"/>`);
        }
        lines.push('    </properties>');
      }

      // Test cases
      for (const tc of suite.testcases) {
        const assertions = tc.assertions ? ` assertions="${tc.assertions}"` : '';

        if (!tc.failure && !tc.error && !tc.skipped && !tc.systemOut && !tc.systemErr) {
          lines.push(`    <testcase name="${this.escapeXml(tc.name)}" classname="${this.escapeXml(tc.classname)}" time="${tc.time.toFixed(3)}"${assertions}/>`);
        } else {
          lines.push(`    <testcase name="${this.escapeXml(tc.name)}" classname="${this.escapeXml(tc.classname)}" time="${tc.time.toFixed(3)}"${assertions}>`);

          if (tc.failure) {
            lines.push(`      <failure message="${this.escapeXml(tc.failure.message)}" type="${this.escapeXml(tc.failure.type)}">`);
            if (tc.failure.content) {
              lines.push(`<![CDATA[${tc.failure.content}]]>`);
            }
            lines.push('      </failure>');
          }

          if (tc.error) {
            lines.push(`      <error message="${this.escapeXml(tc.error.message)}" type="${this.escapeXml(tc.error.type)}">`);
            if (tc.error.content) {
              lines.push(`<![CDATA[${tc.error.content}]]>`);
            }
            lines.push('      </error>');
          }

          if (tc.skipped) {
            lines.push(`      <skipped${tc.skipped.message ? ` message="${this.escapeXml(tc.skipped.message)}"` : ''}/>`);
          }

          if (tc.systemOut) {
            lines.push('      <system-out><![CDATA[' + tc.systemOut + ']]></system-out>');
          }

          if (tc.systemErr) {
            lines.push('      <system-err><![CDATA[' + tc.systemErr + ']]></system-err>');
          }

          lines.push('    </testcase>');
        }
      }

      // Suite system-out/err
      if (suite.systemOut) {
        lines.push('    <system-out><![CDATA[' + suite.systemOut + ']]></system-out>');
      }
      if (suite.systemErr) {
        lines.push('    <system-err><![CDATA[' + suite.systemErr + ']]></system-err>');
      }

      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');

    return lines.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// JUnit XML structure types
interface JUnitTestSuites {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testsuites: JUnitTestSuite[];
}

interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  timestamp: string;
  hostname: string;
  package: string;
  properties: JUnitProperty[];
  testcases: JUnitTestCase[];
  systemOut?: string;
  systemErr?: string;
}

interface JUnitProperty {
  name: string;
  value: string;
}

interface JUnitTestCase {
  name: string;
  classname: string;
  time: number;
  assertions?: number;
  failure?: {
    message: string;
    type: string;
    content?: string;
  };
  error?: {
    message: string;
    type: string;
    content?: string;
  };
  skipped?: {
    message?: string;
  };
  systemOut?: string;
  systemErr?: string;
}
