/**
 * Prometheus Metrics Service
 * Exposes application metrics in Prometheus format
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../database/yugabyte-client.js';
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';

// Metric types
type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labels?: string[];
}

interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

class MetricsRegistry {
  private metrics: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();
  private histogramBuckets: Map<string, number[]> = new Map();

  // Default histogram buckets for request duration
  private readonly defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  /**
   * Register a new metric
   */
  register(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.values.set(definition.name, []);
  }

  /**
   * Increment a counter
   */
  incCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') return;

    const values = this.values.get(name) || [];
    const existing = values.find(v => this.labelsMatch(v.labels, labels));

    if (existing) {
      existing.value += value;
    } else {
      values.push({ value, labels });
      this.values.set(name, values);
    }
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;

    const values = this.values.get(name) || [];
    const existing = values.find(v => this.labelsMatch(v.labels, labels));

    if (existing) {
      existing.value = value;
    } else {
      values.push({ value, labels });
      this.values.set(name, values);
    }
  }

  /**
   * Increment a gauge
   */
  incGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;

    const values = this.values.get(name) || [];
    const existing = values.find(v => this.labelsMatch(v.labels, labels));

    if (existing) {
      existing.value += value;
    } else {
      values.push({ value, labels });
      this.values.set(name, values);
    }
  }

  /**
   * Decrement a gauge
   */
  decGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    this.incGauge(name, labels, -value);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') return;

    const buckets = this.histogramBuckets.get(name) || this.defaultBuckets;
    const values = this.values.get(name) || [];

    // Update count and sum
    const countKey = `${name}_count`;
    const sumKey = `${name}_sum`;

    let countEntry = values.find(v => v.labels._type === 'count' && this.labelsMatch(v.labels, labels));
    let sumEntry = values.find(v => v.labels._type === 'sum' && this.labelsMatch(v.labels, labels));

    if (countEntry) {
      countEntry.value += 1;
    } else {
      values.push({ value: 1, labels: { ...labels, _type: 'count' } });
    }

    if (sumEntry) {
      sumEntry.value += value;
    } else {
      values.push({ value, labels: { ...labels, _type: 'sum' } });
    }

    // Update buckets
    for (const bucket of buckets) {
      const bucketEntry = values.find(
        v => v.labels._type === 'bucket' && v.labels.le === String(bucket) && this.labelsMatch(v.labels, labels)
      );

      if (value <= bucket) {
        if (bucketEntry) {
          bucketEntry.value += 1;
        } else {
          values.push({ value: 1, labels: { ...labels, _type: 'bucket', le: String(bucket) } });
        }
      }
    }

    // +Inf bucket
    const infEntry = values.find(
      v => v.labels._type === 'bucket' && v.labels.le === '+Inf' && this.labelsMatch(v.labels, labels)
    );

    if (infEntry) {
      infEntry.value += 1;
    } else {
      values.push({ value: 1, labels: { ...labels, _type: 'bucket', le: '+Inf' } });
    }

    this.values.set(name, values);
  }

  /**
   * Set histogram buckets
   */
  setHistogramBuckets(name: string, buckets: number[]): void {
    this.histogramBuckets.set(name, buckets.sort((a, b) => a - b));
  }

  /**
   * Generate Prometheus text format output
   */
  async getMetrics(): Promise<string> {
    const lines: string[] = [];

    // Add process metrics
    await this.addProcessMetrics(lines);

    // Add registered metrics
    for (const [name, definition] of this.metrics) {
      lines.push(`# HELP ${name} ${definition.help}`);
      lines.push(`# TYPE ${name} ${definition.type}`);

      const values = this.values.get(name) || [];

      if (definition.type === 'histogram') {
        this.formatHistogram(name, values, lines);
      } else {
        for (const entry of values) {
          const labelStr = this.formatLabels(entry.labels);
          lines.push(`${name}${labelStr} ${entry.value}`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }

  private formatHistogram(name: string, values: MetricValue[], lines: string[]): void {
    // Group by label set (excluding _type and le)
    const groups = new Map<string, MetricValue[]>();

    for (const entry of values) {
      const baseLabels = { ...entry.labels };
      delete baseLabels._type;
      delete baseLabels.le;
      const key = JSON.stringify(baseLabels);

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    for (const [, groupValues] of groups) {
      // Find base labels
      const baseLabels = { ...groupValues[0].labels };
      delete baseLabels._type;
      delete baseLabels.le;

      // Output buckets
      const buckets = groupValues
        .filter(v => v.labels._type === 'bucket')
        .sort((a, b) => {
          if (a.labels.le === '+Inf') return 1;
          if (b.labels.le === '+Inf') return -1;
          return parseFloat(a.labels.le!) - parseFloat(b.labels.le!);
        });

      for (const bucket of buckets) {
        const labels = { ...baseLabels, le: bucket.labels.le };
        const labelStr = this.formatLabels(labels);
        lines.push(`${name}_bucket${labelStr} ${bucket.value}`);
      }

      // Output sum and count
      const sumEntry = groupValues.find(v => v.labels._type === 'sum');
      const countEntry = groupValues.find(v => v.labels._type === 'count');
      const labelStr = this.formatLabels(baseLabels);

      if (sumEntry) {
        lines.push(`${name}_sum${labelStr} ${sumEntry.value}`);
      }
      if (countEntry) {
        lines.push(`${name}_count${labelStr} ${countEntry.value}`);
      }
    }
  }

  private formatLabels(labels: Record<string, string>): string {
    const filteredLabels = { ...labels };
    delete filteredLabels._type;

    const entries = Object.entries(filteredLabels);
    if (entries.length === 0) return '';

    const labelPairs = entries.map(([k, v]) => `${k}="${v}"`);
    return `{${labelPairs.join(',')}}`;
  }

  private labelsMatch(a: Record<string, string>, b: Record<string, string>): boolean {
    const aKeys = Object.keys(a).filter(k => !k.startsWith('_'));
    const bKeys = Object.keys(b).filter(k => !k.startsWith('_'));

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(key => a[key] === b[key]);
  }

  private async addProcessMetrics(lines: string[]): Promise<void> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Process memory
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${memUsage.rss}`);

    lines.push('# HELP process_heap_bytes Process heap size in bytes.');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes ${memUsage.heapUsed}`);

    // Process uptime
    lines.push('# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.');
    lines.push('# TYPE process_start_time_seconds gauge');
    lines.push(`process_start_time_seconds ${Math.floor(Date.now() / 1000 - process.uptime())}`);

    // Node.js version info
    lines.push('# HELP nodejs_version_info Node.js version info.');
    lines.push('# TYPE nodejs_version_info gauge');
    lines.push(`nodejs_version_info{version="${process.version}"} 1`);

    // Database connection pool metrics
    try {
      const dbHealth = await db.healthCheck();
      lines.push('# HELP db_connection_healthy Database connection health.');
      lines.push('# TYPE db_connection_healthy gauge');
      lines.push(`db_connection_healthy ${dbHealth.status === 'ok' ? 1 : 0}`);

      lines.push('# HELP db_query_latency_ms Database query latency in milliseconds.');
      lines.push('# TYPE db_query_latency_ms gauge');
      lines.push(`db_query_latency_ms ${dbHealth.latency}`);
    } catch {
      // Skip database metrics if unavailable
    }
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    for (const name of this.values.keys()) {
      this.values.set(name, []);
    }
  }
}

// Global registry instance
export const metricsRegistry = new MetricsRegistry();

// Register default metrics
metricsRegistry.register({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  type: 'counter',
  labels: ['method', 'path', 'status'],
});

metricsRegistry.register({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  type: 'histogram',
  labels: ['method', 'path', 'status'],
});

metricsRegistry.register({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  type: 'gauge',
  labels: ['method'],
});

metricsRegistry.register({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  type: 'counter',
  labels: ['operation'],
});

metricsRegistry.register({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  type: 'counter',
  labels: ['type', 'result'],
});

metricsRegistry.register({
  name: 'ai_requests_total',
  help: 'Total number of AI API requests',
  type: 'counter',
  labels: ['model', 'status'],
});

metricsRegistry.register({
  name: 'test_executions_total',
  help: 'Total number of test executions',
  type: 'counter',
  labels: ['status'],
});

/**
 * Metrics collection middleware
 */
async function metricsPlugin(fastify: FastifyInstance): Promise<void> {
  if (!config.metrics.enabled) {
    logger.info('Metrics collection disabled');
    return;
  }

  // Track request start time
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).startTime = process.hrtime.bigint();
    metricsRegistry.incGauge('http_requests_in_flight', { method: request.method });
  });

  // Record request metrics on response
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).startTime as bigint;
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9; // Convert to seconds

    const path = normalizeMetricPath(request.url);
    const labels = {
      method: request.method,
      path,
      status: String(reply.statusCode),
    };

    metricsRegistry.incCounter('http_requests_total', labels);
    metricsRegistry.observeHistogram('http_request_duration_seconds', duration, labels);
    metricsRegistry.decGauge('http_requests_in_flight', { method: request.method });
  });

  // Metrics endpoint
  fastify.get(config.metrics.path, async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await metricsRegistry.getMetrics();
    reply.header('Content-Type', 'text/plain; version=0.0.4');
    return metrics;
  });

  logger.info({ path: config.metrics.path }, 'Metrics endpoint registered');
}

/**
 * Normalize URL path for metrics (remove IDs, query params)
 */
function normalizeMetricPath(url: string): string {
  // Remove query string
  const path = url.split('?')[0];

  // Replace UUIDs with :id
  const normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );

  // Replace numeric IDs (2+ digits to avoid corrupting /v1, /v2 etc.)
  return normalized.replace(/\/\d{2,}/g, '/:id');
}

export default fp(metricsPlugin, {
  name: 'metrics',
  fastify: '4.x',
});
