/**
 * Context Service System
 *
 * Provides a framework for registering and running background services
 * that collect metrics, monitor resources, or perform other tasks during
 * test execution.
 *
 * Services run in the context and can:
 * - Collect metrics from various sources (Prometheus, databases, APIs)
 * - Monitor system resources (CPU, memory, network)
 * - Aggregate data over time
 * - Provide snapshots for reporting
 */

import { EventEmitter } from 'events';
import axios from 'axios';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description?: string;
  unit?: string;
  labels?: string[];
}

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface TimeSeries {
  name: string;
  values: { timestamp: Date; value: number }[];
  maxPoints?: number;
}

export interface ServiceSnapshot {
  serviceName: string;
  collectedAt: Date;
  metrics: Record<string, {
    value: number;
    unit?: string;
    type: MetricType;
    labels?: Record<string, string>;
  }>;
  timeSeries?: TimeSeries[];
}

export interface ServiceConfig {
  name: string;
  type: string;
  enabled?: boolean;
  interval?: number;  // Collection interval in ms
  config?: Record<string, any>;
}

/**
 * Base class for context services
 */
export abstract class ContextService extends EventEmitter {
  protected name: string;
  protected metrics: Map<string, MetricValue[]> = new Map();
  protected timeSeries: Map<string, TimeSeries> = new Map();
  protected definitions: Map<string, MetricDefinition> = new Map();
  protected running: boolean = false;
  protected interval?: NodeJS.Timeout;
  protected collectionInterval: number;

  constructor(name: string, collectionInterval = 5000) {
    super();
    this.name = name;
    this.collectionInterval = collectionInterval;
  }

  /**
   * Start the service
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.onStart();
    this.collect();
    this.interval = setInterval(() => this.collect(), this.collectionInterval);
    this.emit('started', { name: this.name });
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.onStop();
    this.emit('stopped', { name: this.name });
  }

  /**
   * Register a metric definition
   */
  protected registerMetric(definition: MetricDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  /**
   * Record a metric value
   */
  protected recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const values = this.metrics.get(key) || [];
    values.push({ value, timestamp: new Date(), labels });

    // Keep only last 1000 values per metric
    if (values.length > 1000) {
      values.shift();
    }

    this.metrics.set(key, values);

    // Update time series
    this.updateTimeSeries(name, value);
  }

  /**
   * Update time series data
   */
  private updateTimeSeries(name: string, value: number): void {
    let series = this.timeSeries.get(name);
    if (!series) {
      series = { name, values: [], maxPoints: 100 };
      this.timeSeries.set(name, series);
    }

    series.values.push({ timestamp: new Date(), value });

    // Keep only maxPoints
    if (series.values.length > (series.maxPoints || 100)) {
      series.values.shift();
    }
  }

  /**
   * Get the latest value for a metric
   */
  getLatestValue(name: string, labels?: Record<string, string>): number | undefined {
    const key = this.getMetricKey(name, labels);
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return undefined;
    return values[values.length - 1].value;
  }

  /**
   * Get all values for a metric
   */
  getValues(name: string, labels?: Record<string, string>): MetricValue[] {
    const key = this.getMetricKey(name, labels);
    return this.metrics.get(key) || [];
  }

  /**
   * Get time series data
   */
  getTimeSeries(name: string): TimeSeries | undefined {
    return this.timeSeries.get(name);
  }

  /**
   * Get a snapshot of all metrics
   */
  getSnapshot(): ServiceSnapshot {
    const metricsSnapshot: ServiceSnapshot['metrics'] = {};

    for (const [key, values] of this.metrics) {
      if (values.length === 0) continue;

      const latest = values[values.length - 1];
      const [name] = key.split(':');
      const definition = this.definitions.get(name);

      metricsSnapshot[key] = {
        value: latest.value,
        unit: definition?.unit,
        type: definition?.type || 'gauge',
        labels: latest.labels,
      };
    }

    return {
      serviceName: this.name,
      collectedAt: new Date(),
      metrics: metricsSnapshot,
      timeSeries: Array.from(this.timeSeries.values()),
    };
  }

  /**
   * Get metric key with labels
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}:{${labelStr}}`;
  }

  /**
   * Calculate aggregates
   */
  protected calculateStats(values: number[]): {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      sum,
      count: values.length,
      p50: this.percentile(sorted, 50),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Abstract methods to implement
  protected abstract onStart(): void;
  protected abstract onStop(): void;
  protected abstract collect(): Promise<void> | void;
}

/**
 * Prometheus Metrics Collector
 * Collects metrics from a Prometheus endpoint
 */
export class PrometheusCollector extends ContextService {
  private endpoint: string;
  private queries: { name: string; query: string }[];
  private timeout: number;

  constructor(config: {
    endpoint: string;
    queries: { name: string; query: string }[];
    interval?: number;
    timeout?: number;
  }) {
    super('prometheus', config.interval || 10000);
    this.endpoint = config.endpoint;
    this.queries = config.queries;
    this.timeout = config.timeout || 5000;

    // Register metric definitions
    for (const q of this.queries) {
      this.registerMetric({
        name: q.name,
        type: 'gauge',
        description: `Prometheus query: ${q.query}`,
      });
    }
  }

  protected onStart(): void {
    // Nothing special on start
  }

  protected onStop(): void {
    // Nothing special on stop
  }

  protected async collect(): Promise<void> {
    for (const query of this.queries) {
      try {
        const response = await axios.get(`${this.endpoint}/api/v1/query`, {
          params: { query: query.query },
          timeout: this.timeout,
        });

        if (response.data.status === 'success' && response.data.data.result.length > 0) {
          const result = response.data.data.result[0];
          const value = parseFloat(result.value[1]);
          this.recordMetric(query.name, value, result.metric);
        }
      } catch (err) {
        this.emit('error', { query: query.name, error: err });
      }
    }
  }
}

/**
 * System Resource Monitor
 * Collects CPU, memory, and other system metrics
 */
export class SystemResourceMonitor extends ContextService {
  private lastCpuUsage?: NodeJS.CpuUsage;

  constructor(interval = 5000) {
    super('system-resources', interval);

    this.registerMetric({ name: 'cpu_usage_percent', type: 'gauge', unit: '%' });
    this.registerMetric({ name: 'memory_used_bytes', type: 'gauge', unit: 'bytes' });
    this.registerMetric({ name: 'memory_total_bytes', type: 'gauge', unit: 'bytes' });
    this.registerMetric({ name: 'memory_used_percent', type: 'gauge', unit: '%' });
    this.registerMetric({ name: 'heap_used_bytes', type: 'gauge', unit: 'bytes' });
    this.registerMetric({ name: 'heap_total_bytes', type: 'gauge', unit: 'bytes' });
    this.registerMetric({ name: 'external_bytes', type: 'gauge', unit: 'bytes' });
    this.registerMetric({ name: 'event_loop_lag_ms', type: 'gauge', unit: 'ms' });
  }

  protected onStart(): void {
    this.lastCpuUsage = process.cpuUsage();
  }

  protected onStop(): void {
    this.lastCpuUsage = undefined;
  }

  protected collect(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.recordMetric('heap_used_bytes', memUsage.heapUsed);
    this.recordMetric('heap_total_bytes', memUsage.heapTotal);
    this.recordMetric('external_bytes', memUsage.external);

    // OS memory (if available)
    try {
      const os = require('os');
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      this.recordMetric('memory_total_bytes', totalMem);
      this.recordMetric('memory_used_bytes', usedMem);
      this.recordMetric('memory_used_percent', (usedMem / totalMem) * 100);
    } catch {
      // OS module not available
    }

    // CPU usage
    if (this.lastCpuUsage) {
      const currentUsage = process.cpuUsage(this.lastCpuUsage);
      const totalUsage = currentUsage.user + currentUsage.system;
      const elapsedMs = this.collectionInterval * 1000; // Convert to microseconds
      const cpuPercent = (totalUsage / elapsedMs) * 100;
      this.recordMetric('cpu_usage_percent', Math.min(100, cpuPercent));
    }
    this.lastCpuUsage = process.cpuUsage();

    // Event loop lag
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      this.recordMetric('event_loop_lag_ms', lag);
    });
  }
}

/**
 * HTTP Endpoint Monitor
 * Monitors response times and availability of HTTP endpoints
 */
export class HttpEndpointMonitor extends ContextService {
  private endpoints: { name: string; url: string; method?: string; expectedStatus?: number }[];
  private timeout: number;

  constructor(config: {
    endpoints: { name: string; url: string; method?: string; expectedStatus?: number }[];
    interval?: number;
    timeout?: number;
  }) {
    super('http-endpoints', config.interval || 30000);
    this.endpoints = config.endpoints;
    this.timeout = config.timeout || 10000;

    for (const ep of this.endpoints) {
      this.registerMetric({ name: `${ep.name}_response_time_ms`, type: 'gauge', unit: 'ms' });
      this.registerMetric({ name: `${ep.name}_status_code`, type: 'gauge' });
      this.registerMetric({ name: `${ep.name}_available`, type: 'gauge' });
    }
  }

  protected onStart(): void {}
  protected onStop(): void {}

  protected async collect(): Promise<void> {
    for (const endpoint of this.endpoints) {
      const start = Date.now();
      try {
        const response = await axios({
          method: endpoint.method || 'GET',
          url: endpoint.url,
          timeout: this.timeout,
          validateStatus: () => true,  // Don't throw on any status
        });

        const responseTime = Date.now() - start;
        const available = endpoint.expectedStatus
          ? response.status === endpoint.expectedStatus
          : response.status >= 200 && response.status < 400;

        this.recordMetric(`${endpoint.name}_response_time_ms`, responseTime);
        this.recordMetric(`${endpoint.name}_status_code`, response.status);
        this.recordMetric(`${endpoint.name}_available`, available ? 1 : 0);
      } catch (err) {
        const responseTime = Date.now() - start;
        this.recordMetric(`${endpoint.name}_response_time_ms`, responseTime);
        this.recordMetric(`${endpoint.name}_status_code`, 0);
        this.recordMetric(`${endpoint.name}_available`, 0);
      }
    }
  }
}

/**
 * Database Connection Monitor
 * Monitors database connection pool and query performance
 */
export class DatabaseMonitor extends ContextService {
  private connectionString: string;
  private poolMetricsQuery?: string;
  private testQuery: string;

  constructor(config: {
    connectionString: string;
    testQuery?: string;
    poolMetricsQuery?: string;
    interval?: number;
  }) {
    super('database', config.interval || 10000);
    this.connectionString = config.connectionString;
    this.testQuery = config.testQuery || 'SELECT 1';
    this.poolMetricsQuery = config.poolMetricsQuery;

    this.registerMetric({ name: 'db_query_time_ms', type: 'gauge', unit: 'ms' });
    this.registerMetric({ name: 'db_available', type: 'gauge' });
    this.registerMetric({ name: 'db_active_connections', type: 'gauge' });
    this.registerMetric({ name: 'db_idle_connections', type: 'gauge' });
  }

  protected onStart(): void {}
  protected onStop(): void {}

  protected async collect(): Promise<void> {
    // This is a placeholder - actual implementation would use a database client
    // In real implementation, inject the database client from context

    const start = Date.now();
    try {
      // Simulate a database health check
      // In production, execute this.testQuery against the database
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

      const queryTime = Date.now() - start;
      this.recordMetric('db_query_time_ms', queryTime);
      this.recordMetric('db_available', 1);

      // Pool metrics would come from the connection pool
      // this.recordMetric('db_active_connections', pool.activeCount);
      // this.recordMetric('db_idle_connections', pool.idleCount);
    } catch (err) {
      this.recordMetric('db_query_time_ms', Date.now() - start);
      this.recordMetric('db_available', 0);
    }
  }
}

/**
 * Custom Metrics Collector
 * Allows registering and collecting custom metrics
 */
export class CustomMetricsCollector extends ContextService {
  private collectors: Map<string, () => Promise<number> | number> = new Map();

  constructor(name = 'custom', interval = 5000) {
    super(name, interval);
  }

  /**
   * Register a custom metric with its collector function
   */
  addMetric(
    name: string,
    collector: () => Promise<number> | number,
    definition?: Partial<MetricDefinition>
  ): void {
    this.collectors.set(name, collector);
    this.registerMetric({
      name,
      type: definition?.type || 'gauge',
      description: definition?.description,
      unit: definition?.unit,
      labels: definition?.labels,
    });
  }

  /**
   * Remove a custom metric
   */
  removeMetric(name: string): void {
    this.collectors.delete(name);
  }

  /**
   * Manually set a metric value
   */
  setMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, delta = 1, labels?: Record<string, string>): void {
    const current = this.getLatestValue(name, labels) || 0;
    this.recordMetric(name, current + delta, labels);
  }

  protected onStart(): void {}
  protected onStop(): void {}

  protected async collect(): Promise<void> {
    for (const [name, collector] of this.collectors) {
      try {
        const value = await collector();
        this.recordMetric(name, value);
      } catch (err) {
        this.emit('error', { metric: name, error: err });
      }
    }
  }
}

/**
 * Context Service Manager
 * Manages multiple context services for an execution
 */
export class ContextServiceManager {
  private services: Map<string, ContextService> = new Map();
  private running: boolean = false;

  /**
   * Register a service
   */
  register(service: ContextService): void {
    const snapshot = service.getSnapshot();
    if (this.services.has(snapshot.serviceName)) {
      throw new Error(`Service ${snapshot.serviceName} already registered`);
    }
    this.services.set(snapshot.serviceName, service);

    if (this.running) {
      service.start();
    }
  }

  /**
   * Unregister a service
   */
  unregister(name: string): void {
    const service = this.services.get(name);
    if (service) {
      service.stop();
      this.services.delete(name);
    }
  }

  /**
   * Get a service by name
   */
  get<T extends ContextService>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /**
   * Start all services
   */
  startAll(): void {
    this.running = true;
    for (const service of this.services.values()) {
      service.start();
    }
  }

  /**
   * Stop all services
   */
  stopAll(): void {
    this.running = false;
    for (const service of this.services.values()) {
      service.stop();
    }
  }

  /**
   * Get snapshots from all services
   */
  getAllSnapshots(): Record<string, ServiceSnapshot> {
    const snapshots: Record<string, ServiceSnapshot> = {};
    for (const [name, service] of this.services) {
      snapshots[name] = service.getSnapshot();
    }
    return snapshots;
  }

  /**
   * Get combined metrics from all services
   */
  getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    for (const [name, service] of this.services) {
      const snapshot = service.getSnapshot();
      for (const [metricName, value] of Object.entries(snapshot.metrics)) {
        metrics[`${name}.${metricName}`] = value;
      }
    }
    return metrics;
  }
}

/**
 * Factory function to create services from configuration
 */
export function createService(config: ServiceConfig): ContextService {
  switch (config.type) {
    case 'prometheus':
      return new PrometheusCollector({
        endpoint: config.config?.endpoint,
        queries: config.config?.queries || [],
        interval: config.interval,
        timeout: config.config?.timeout,
      });

    case 'system':
      return new SystemResourceMonitor(config.interval);

    case 'http':
      return new HttpEndpointMonitor({
        endpoints: config.config?.endpoints || [],
        interval: config.interval,
        timeout: config.config?.timeout,
      });

    case 'database':
      return new DatabaseMonitor({
        connectionString: config.config?.connectionString,
        testQuery: config.config?.testQuery,
        poolMetricsQuery: config.config?.poolMetricsQuery,
        interval: config.interval,
      });

    case 'custom':
      return new CustomMetricsCollector(config.name, config.interval);

    default:
      throw new Error(`Unknown service type: ${config.type}`);
  }
}
