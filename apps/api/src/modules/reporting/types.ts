/**
 * Reporting Types
 *
 * Type definitions for test execution reports
 */

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'error' | 'pending' | 'running';

export interface TestMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;  // milliseconds

  // Performance metrics
  responseTime?: number;
  throughput?: number;
  bytesReceived?: number;
  bytesSent?: number;

  // Resource metrics
  cpuUsage?: number;
  memoryUsage?: number;

  // Custom metrics
  custom?: Record<string, number>;
}

export interface AssertionResult {
  name: string;
  type: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  message?: string;
  duration?: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export interface StepResult {
  id: string;
  name: string;
  type: string;
  status: TestStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;

  // Results
  assertions: AssertionResult[];
  error?: {
    message: string;
    stack?: string;
    type?: string;
  };

  // Output
  output?: string;
  extractedVariables?: Record<string, any>;

  // Metrics and logs
  metrics: TestMetrics;
  logs: LogEntry[];

  // Screenshots/attachments
  attachments?: Attachment[];

  // Nested steps (for transaction controllers)
  children?: StepResult[];
}

export interface Attachment {
  name: string;
  type: 'screenshot' | 'log' | 'file' | 'video';
  mimeType: string;
  path?: string;
  content?: string;  // Base64 for inline
  size?: number;
}

export interface ExecutionSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;

  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;

  duration: number;
  startTime: Date;
  endTime: Date;

  // Aggregate metrics
  avgResponseTime?: number;
  maxResponseTime?: number;
  minResponseTime?: number;
  p50ResponseTime?: number;
  p90ResponseTime?: number;
  p95ResponseTime?: number;
  p99ResponseTime?: number;

  throughput?: number;
  errorRate?: number;
}

export interface ExecutionReport {
  // Metadata
  id: string;
  planId?: string;
  planName: string;
  planVersion?: string;
  environment: string;

  // Execution info
  executionId: string;
  triggeredBy?: string;
  buildNumber?: string;
  gitCommit?: string;
  gitBranch?: string;

  // Timestamps
  startTime: Date;
  endTime: Date;
  duration: number;

  // Results
  status: 'success' | 'failed' | 'error' | 'aborted';
  summary: ExecutionSummary;
  steps: StepResult[];

  // Global logs and metrics
  logs: LogEntry[];
  metrics: TestMetrics;

  // Context snapshot
  variables?: Record<string, any>;

  // Service metrics (from context services)
  serviceMetrics?: Record<string, ServiceMetricsSnapshot>;
}

export interface ServiceMetricsSnapshot {
  serviceName: string;
  collectedAt: Date;
  metrics: Record<string, MetricValue>;
  timeSeries?: TimeSeriesData[];
}

export interface MetricValue {
  value: number;
  unit?: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
}

export interface TimeSeriesData {
  name: string;
  timestamps: Date[];
  values: number[];
  unit?: string;
}

export type ReportFormat = 'junit' | 'html' | 'json' | 'markdown' | 'csv';

export interface ReportOptions {
  format: ReportFormat;
  includeLogss?: boolean;
  includeMetrics?: boolean;
  includeAttachments?: boolean;
  maskSensitiveData?: boolean;
  title?: string;
  outputPath?: string;
}
