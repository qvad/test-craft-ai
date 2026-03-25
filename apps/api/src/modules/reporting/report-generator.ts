/**
 * Report Generator
 *
 * Main orchestrator for generating reports in multiple formats
 */

import { ExecutionReport, ReportFormat, ReportOptions, StepResult, ExecutionSummary, LogEntry } from './types';
import { JUnitReporter, JUnitOptions } from './junit-reporter';
import { HtmlReporter, HtmlReportOptions } from './html-reporter';
import { ServiceSnapshot } from '../context/context-service';

export interface GeneratorOptions {
  junitOptions?: JUnitOptions;
  htmlOptions?: HtmlReportOptions;
  maskSensitiveData?: boolean;
  includeLogs?: boolean;
  includeMetrics?: boolean;
}

export class ReportGenerator {
  private junitReporter: JUnitReporter;
  private htmlReporter: HtmlReporter;
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions = {}) {
    this.options = {
      maskSensitiveData: true,
      includeLogs: true,
      includeMetrics: true,
      ...options,
    };

    this.junitReporter = new JUnitReporter(options.junitOptions);
    this.htmlReporter = new HtmlReporter(options.htmlOptions);
  }

  /**
   * Generate a report in the specified format
   */
  generate(report: ExecutionReport, format: ReportFormat): string {
    // Apply masking if needed
    const processedReport = this.options.maskSensitiveData
      ? this.maskSensitiveDataInReport(report)
      : report;

    switch (format) {
      case 'junit':
        return this.junitReporter.generate(processedReport);

      case 'html':
        return this.htmlReporter.generate(processedReport);

      case 'json':
        return this.generateJson(processedReport);

      case 'markdown':
        return this.generateMarkdown(processedReport);

      case 'csv':
        return this.generateCsv(processedReport);

      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Generate reports in multiple formats
   */
  generateAll(report: ExecutionReport, formats: ReportFormat[]): Map<ReportFormat, string> {
    const results = new Map<ReportFormat, string>();

    for (const format of formats) {
      results.set(format, this.generate(report, format));
    }

    return results;
  }

  /**
   * Generate JSON report
   */
  private generateJson(report: ExecutionReport): string {
    return JSON.stringify(report, (key, value) => {
      // Convert Date objects to ISO strings
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(report: ExecutionReport): string {
    const lines: string[] = [];
    const { summary } = report;

    // Header
    lines.push(`# ${report.planName} - Test Report`);
    lines.push('');
    lines.push(`**Status:** ${this.getStatusEmoji(report.status)} ${report.status.toUpperCase()}`);
    lines.push(`**Environment:** ${report.environment}`);
    lines.push(`**Execution ID:** \`${report.executionId}\``);
    lines.push(`**Duration:** ${this.formatDuration(report.duration)}`);
    lines.push(`**Date:** ${new Date(report.startTime).toISOString()}`);

    if (report.gitBranch || report.gitCommit) {
      lines.push('');
      lines.push('### Git Info');
      if (report.gitBranch) lines.push(`- **Branch:** ${report.gitBranch}`);
      if (report.gitCommit) lines.push(`- **Commit:** \`${report.gitCommit}\``);
    }

    // Summary
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Tests | ${summary.totalTests} |`);
    lines.push(`| Passed | ${summary.passed} ✅ |`);
    lines.push(`| Failed | ${summary.failed} ❌ |`);
    lines.push(`| Skipped | ${summary.skipped} ⏭️ |`);
    lines.push(`| Assertions | ${summary.passedAssertions}/${summary.totalAssertions} |`);

    // Performance metrics
    if (summary.avgResponseTime !== undefined) {
      lines.push('');
      lines.push('## Performance Metrics');
      lines.push('');
      lines.push('| Metric | Value |');
      lines.push('|--------|-------|');
      if (summary.avgResponseTime) lines.push(`| Avg Response Time | ${summary.avgResponseTime.toFixed(2)}ms |`);
      if (summary.p50ResponseTime) lines.push(`| P50 Response Time | ${summary.p50ResponseTime.toFixed(2)}ms |`);
      if (summary.p95ResponseTime) lines.push(`| P95 Response Time | ${summary.p95ResponseTime.toFixed(2)}ms |`);
      if (summary.p99ResponseTime) lines.push(`| P99 Response Time | ${summary.p99ResponseTime.toFixed(2)}ms |`);
      if (summary.throughput) lines.push(`| Throughput | ${summary.throughput.toFixed(2)} req/s |`);
      if (summary.errorRate !== undefined) lines.push(`| Error Rate | ${(summary.errorRate * 100).toFixed(2)}% |`);
    }

    // Test Results
    lines.push('');
    lines.push('## Test Results');
    lines.push('');

    for (const step of report.steps) {
      lines.push(this.stepToMarkdown(step, 0));
    }

    // Failed Tests Details
    const failedSteps = report.steps.filter(s => s.status === 'failed' || s.status === 'error');
    if (failedSteps.length > 0) {
      lines.push('');
      lines.push('## Failed Tests Details');
      lines.push('');

      for (const step of failedSteps) {
        lines.push(`### ❌ ${step.name}`);
        lines.push('');

        if (step.error) {
          lines.push('**Error:**');
          lines.push('```');
          lines.push(step.error.message);
          if (step.error.stack) {
            lines.push('');
            lines.push(step.error.stack);
          }
          lines.push('```');
        }

        const failedAssertions = step.assertions.filter(a => !a.passed);
        if (failedAssertions.length > 0) {
          lines.push('');
          lines.push('**Failed Assertions:**');
          for (const assertion of failedAssertions) {
            lines.push(`- ${assertion.name}: ${assertion.message || 'Failed'}`);
            if (assertion.expected !== undefined) {
              lines.push(`  - Expected: \`${JSON.stringify(assertion.expected)}\``);
            }
            if (assertion.actual !== undefined) {
              lines.push(`  - Actual: \`${JSON.stringify(assertion.actual)}\``);
            }
          }
        }
        lines.push('');
      }
    }

    // Service Metrics
    if (report.serviceMetrics && Object.keys(report.serviceMetrics).length > 0) {
      lines.push('');
      lines.push('## Service Metrics');
      lines.push('');

      for (const [name, snapshot] of Object.entries(report.serviceMetrics)) {
        lines.push(`### ${snapshot.serviceName}`);
        lines.push('');
        lines.push('| Metric | Value | Type |');
        lines.push('|--------|-------|------|');

        for (const [metricName, metric] of Object.entries(snapshot.metrics)) {
          const value = metric.unit ? `${metric.value} ${metric.unit}` : metric.value;
          lines.push(`| ${metricName} | ${value} | ${metric.type} |`);
        }
        lines.push('');
      }
    }

    // Footer
    lines.push('---');
    lines.push(`*Generated by TestCraft at ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * Convert a step to markdown
   */
  private stepToMarkdown(step: StepResult, depth: number): string {
    const indent = '  '.repeat(depth);
    const icon = this.getStatusEmoji(step.status);
    const duration = this.formatDuration(step.duration || 0);

    let line = `${indent}- ${icon} **${step.name}** (${step.type}) - ${duration}`;

    if (step.assertions.length > 0) {
      const passed = step.assertions.filter(a => a.passed).length;
      line += ` [${passed}/${step.assertions.length} assertions]`;
    }

    const lines = [line];

    // Add children
    if (step.children && step.children.length > 0) {
      for (const child of step.children) {
        lines.push(this.stepToMarkdown(child, depth + 1));
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate CSV report
   */
  private generateCsv(report: ExecutionReport): string {
    const headers = [
      'Step ID',
      'Step Name',
      'Type',
      'Status',
      'Duration (ms)',
      'Assertions Total',
      'Assertions Passed',
      'Assertions Failed',
      'Error',
      'Start Time',
      'End Time',
    ];

    const rows: string[][] = [headers];

    const flatSteps = this.flattenSteps(report.steps);

    for (const step of flatSteps) {
      const passedAssertions = step.assertions.filter(a => a.passed).length;
      const failedAssertions = step.assertions.length - passedAssertions;

      rows.push([
        step.id,
        this.escapeCsv(step.name),
        step.type,
        step.status,
        String(step.duration || 0),
        String(step.assertions.length),
        String(passedAssertions),
        String(failedAssertions),
        this.escapeCsv(step.error?.message || ''),
        new Date(step.startTime).toISOString(),
        step.endTime ? new Date(step.endTime).toISOString() : '',
      ]);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Flatten nested steps
   */
  private flattenSteps(steps: StepResult[], parent = ''): StepResult[] {
    const result: StepResult[] = [];

    for (const step of steps) {
      result.push(step);

      if (step.children && step.children.length > 0) {
        result.push(...this.flattenSteps(step.children, step.id));
      }
    }

    return result;
  }

  /**
   * Mask sensitive data in report
   */
  private maskSensitiveDataInReport(report: ExecutionReport): ExecutionReport {
    const sensitivePatterns = [
      /password["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi,
      /api[_-]?key["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi,
      /token["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi,
      /secret["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi,
      /bearer\s+([^\s"']+)/gi,
      /:\/\/[^:]+:([^@]+)@/gi,
    ];

    const mask = (str: string): string => {
      let result = str;
      for (const pattern of sensitivePatterns) {
        result = result.replace(pattern, (match, group) => {
          if (group && group.length > 4) {
            return match.replace(group, '****' + group.slice(-4));
          }
          return match.replace(group || match, '********');
        });
      }
      return result;
    };

    const maskStep = (step: StepResult): StepResult => ({
      ...step,
      output: step.output ? mask(step.output) : undefined,
      error: step.error ? { ...step.error, message: mask(step.error.message), stack: step.error.stack ? mask(step.error.stack) : undefined } : undefined,
      logs: step.logs.map(log => ({ ...log, message: mask(log.message) })),
      children: step.children ? step.children.map(maskStep) : undefined,
    });

    return {
      ...report,
      steps: report.steps.map(maskStep),
      logs: report.logs.map(log => ({ ...log, message: mask(log.message) })),
      variables: report.variables ? Object.fromEntries(
        Object.entries(report.variables).map(([k, v]) => [k, typeof v === 'string' ? mask(v) : v])
      ) : undefined,
    };
  }

  // Utility methods
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'passed':
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭️';
      case 'error':
        return '💥';
      case 'running':
        return '🔄';
      default:
        return '❓';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private escapeCsv(str: string): string {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

/**
 * Build an execution report from collected data
 */
export function buildExecutionReport(
  executionId: string,
  planName: string,
  steps: StepResult[],
  options: {
    planId?: string;
    planVersion?: string;
    environment?: string;
    triggeredBy?: string;
    buildNumber?: string;
    gitCommit?: string;
    gitBranch?: string;
    logs?: LogEntry[];
    variables?: Record<string, any>;
    serviceMetrics?: Record<string, ServiceSnapshot>;
    startTime: Date;
    endTime: Date;
  }
): ExecutionReport {
  // Calculate summary
  const summary = calculateSummary(steps, options.startTime, options.endTime);

  // Determine overall status
  const status = summary.failed > 0 || summary.errors > 0
    ? 'failed'
    : summary.totalTests === 0
    ? 'error'
    : 'success';

  return {
    id: `report-${executionId}`,
    planId: options.planId,
    planName,
    planVersion: options.planVersion,
    environment: options.environment || 'default',
    executionId,
    triggeredBy: options.triggeredBy,
    buildNumber: options.buildNumber,
    gitCommit: options.gitCommit,
    gitBranch: options.gitBranch,
    startTime: options.startTime,
    endTime: options.endTime,
    duration: options.endTime.getTime() - options.startTime.getTime(),
    status,
    summary,
    steps,
    logs: options.logs || [],
    metrics: {
      startTime: options.startTime,
      endTime: options.endTime,
      duration: options.endTime.getTime() - options.startTime.getTime(),
    },
    variables: options.variables,
    serviceMetrics: options.serviceMetrics,
  };
}

/**
 * Calculate execution summary from steps
 */
function calculateSummary(steps: StepResult[], startTime: Date, endTime: Date): ExecutionSummary {
  const flatSteps = flattenAllSteps(steps);

  const totalTests = flatSteps.length;
  const passed = flatSteps.filter(s => s.status === 'passed').length;
  const failed = flatSteps.filter(s => s.status === 'failed').length;
  const skipped = flatSteps.filter(s => s.status === 'skipped').length;
  const errors = flatSteps.filter(s => s.status === 'error').length;

  let totalAssertions = 0;
  let passedAssertions = 0;
  const responseTimes: number[] = [];

  for (const step of flatSteps) {
    totalAssertions += step.assertions.length;
    passedAssertions += step.assertions.filter(a => a.passed).length;

    if (step.metrics?.responseTime !== undefined) {
      responseTimes.push(step.metrics.responseTime);
    }
  }

  // Calculate percentiles if we have response times
  let avgResponseTime: number | undefined;
  let maxResponseTime: number | undefined;
  let minResponseTime: number | undefined;
  let p50ResponseTime: number | undefined;
  let p90ResponseTime: number | undefined;
  let p95ResponseTime: number | undefined;
  let p99ResponseTime: number | undefined;

  if (responseTimes.length > 0) {
    const sorted = [...responseTimes].sort((a, b) => a - b);
    avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    minResponseTime = sorted[0];
    maxResponseTime = sorted[sorted.length - 1];
    p50ResponseTime = percentile(sorted, 50);
    p90ResponseTime = percentile(sorted, 90);
    p95ResponseTime = percentile(sorted, 95);
    p99ResponseTime = percentile(sorted, 99);
  }

  const duration = endTime.getTime() - startTime.getTime();
  const throughput = duration > 0 ? (totalTests / duration) * 1000 : undefined;
  const errorRate = totalTests > 0 ? (failed + errors) / totalTests : undefined;

  return {
    totalTests,
    passed,
    failed,
    skipped,
    errors,
    totalAssertions,
    passedAssertions,
    failedAssertions: totalAssertions - passedAssertions,
    duration,
    startTime,
    endTime,
    avgResponseTime,
    maxResponseTime,
    minResponseTime,
    p50ResponseTime,
    p90ResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    throughput,
    errorRate,
  };
}

function flattenAllSteps(steps: StepResult[]): StepResult[] {
  const result: StepResult[] = [];
  for (const step of steps) {
    if (step.children && step.children.length > 0) {
      result.push(...flattenAllSteps(step.children));
    } else {
      result.push(step);
    }
  }
  return result;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
