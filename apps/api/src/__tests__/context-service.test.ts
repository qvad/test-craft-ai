/**
 * Tests for context-service.ts
 *
 * Covers: ContextService base class, PrometheusCollector, SystemResourceMonitor,
 * HttpEndpointMonitor, DatabaseMonitor, CustomMetricsCollector,
 * ContextServiceManager, and createService factory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import {
  ContextService,
  ContextServiceManager,
  CustomMetricsCollector,
  DatabaseMonitor,
  HttpEndpointMonitor,
  PrometheusCollector,
  SystemResourceMonitor,
  createService,
  type MetricDefinition,
  type ServiceConfig,
} from '../modules/context/context-service.js';

// ---------------------------------------------------------------------------
// axios mock
// ---------------------------------------------------------------------------
vi.mock('axios', () => {
  const axiosFn = vi.fn();
  (axiosFn as any).get = vi.fn();
  return { default: axiosFn };
});

const mockedAxios = axios as unknown as ReturnType<typeof vi.fn> & {
  get: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Concrete subclass used to exercise the abstract ContextService base. */
class TestService extends ContextService {
  public onStartCalled = false;
  public onStopCalled = false;
  public collectCallCount = 0;

  constructor(interval = 1_000_000 /* very long so setInterval doesn't fire during tests */) {
    super('test-service', interval);
  }

  registerTestMetric(def: MetricDefinition): void {
    this.registerMetric(def);
  }

  recordTestMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  exposedCalculateStats(values: number[]) {
    return this.calculateStats(values);
  }

  protected onStart(): void {
    this.onStartCalled = true;
  }

  protected onStop(): void {
    this.onStopCalled = true;
  }

  protected collect(): void {
    this.collectCallCount++;
  }
}

// ---------------------------------------------------------------------------
// ContextService (base class via TestService)
// ---------------------------------------------------------------------------

describe('ContextService', () => {
  let svc: TestService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new TestService();
  });

  afterEach(() => {
    svc.stop();
    vi.useRealTimers();
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  describe('start / stop lifecycle', () => {
    it('calls onStart and collect immediately on start()', () => {
      svc.start();
      expect(svc.onStartCalled).toBe(true);
      expect(svc.collectCallCount).toBe(1);
    });

    it('emits "started" event on start', () => {
      const handler = vi.fn();
      svc.on('started', handler);
      svc.start();
      expect(handler).toHaveBeenCalledWith({ name: 'test-service' });
    });

    it('does not start again if already running', () => {
      svc.start();
      svc.start(); // second call should be a no-op
      expect(svc.collectCallCount).toBe(1);
    });

    it('calls onStop on stop()', () => {
      svc.start();
      svc.stop();
      expect(svc.onStopCalled).toBe(true);
    });

    it('emits "stopped" event on stop', () => {
      const handler = vi.fn();
      svc.on('stopped', handler);
      svc.start();
      svc.stop();
      expect(handler).toHaveBeenCalledWith({ name: 'test-service' });
    });

    it('does not stop again if already stopped', () => {
      svc.start();
      svc.stop();
      const stopCount = svc.collectCallCount; // should not change
      svc.stop();
      expect(svc.collectCallCount).toBe(stopCount);
      expect(svc.onStopCalled).toBe(true);
    });

    it('fires collect on each interval tick', () => {
      const interval = 500;
      const timedSvc = new TestService(interval);
      timedSvc.start();
      expect(timedSvc.collectCallCount).toBe(1); // immediate call

      vi.advanceTimersByTime(interval);
      expect(timedSvc.collectCallCount).toBe(2);

      vi.advanceTimersByTime(interval * 2);
      expect(timedSvc.collectCallCount).toBe(4);

      timedSvc.stop();
    });

    it('clears the interval after stop — no more collects', () => {
      const interval = 500;
      const timedSvc = new TestService(interval);
      timedSvc.start();
      timedSvc.stop();
      const countAfterStop = timedSvc.collectCallCount;

      vi.advanceTimersByTime(interval * 3);
      expect(timedSvc.collectCallCount).toBe(countAfterStop);
    });
  });

  // ── Metric recording ──────────────────────────────────────────────────────

  describe('recordMetric / getLatestValue / getValues', () => {
    beforeEach(() => {
      svc.registerTestMetric({ name: 'requests', type: 'counter' });
    });

    it('returns undefined for metric with no recorded values', () => {
      expect(svc.getLatestValue('requests')).toBeUndefined();
    });

    it('records and retrieves the latest metric value', () => {
      svc.recordTestMetric('requests', 10);
      svc.recordTestMetric('requests', 20);
      expect(svc.getLatestValue('requests')).toBe(20);
    });

    it('getValues returns all recorded values in order', () => {
      svc.recordTestMetric('requests', 1);
      svc.recordTestMetric('requests', 2);
      svc.recordTestMetric('requests', 3);
      const values = svc.getValues('requests');
      expect(values.map(v => v.value)).toEqual([1, 2, 3]);
    });

    it('returns empty array for unknown metric name', () => {
      expect(svc.getValues('unknown')).toEqual([]);
    });

    it('caps stored values at 1000 per metric key', () => {
      for (let i = 0; i < 1005; i++) {
        svc.recordTestMetric('requests', i);
      }
      expect(svc.getValues('requests').length).toBe(1000);
      // oldest values are dropped — last value should be the latest recorded
      expect(svc.getLatestValue('requests')).toBe(1004);
    });

    it('supports labels in metric keys', () => {
      svc.recordTestMetric('requests', 5, { method: 'GET' });
      svc.recordTestMetric('requests', 8, { method: 'POST' });
      expect(svc.getLatestValue('requests', { method: 'GET' })).toBe(5);
      expect(svc.getLatestValue('requests', { method: 'POST' })).toBe(8);
    });

    it('label keys are sorted for consistent key generation', () => {
      svc.recordTestMetric('m', 1, { z: '1', a: '2' });
      expect(svc.getLatestValue('m', { a: '2', z: '1' })).toBe(1);
    });
  });

  // ── Time series ───────────────────────────────────────────────────────────

  describe('getTimeSeries', () => {
    it('returns undefined for unknown metric', () => {
      expect(svc.getTimeSeries('nonexistent')).toBeUndefined();
    });

    it('creates a time series when a metric is recorded', () => {
      svc.recordTestMetric('cpu', 42);
      const ts = svc.getTimeSeries('cpu');
      expect(ts).toBeDefined();
      expect(ts!.name).toBe('cpu');
      expect(ts!.values).toHaveLength(1);
      expect(ts!.values[0].value).toBe(42);
    });

    it('appends to time series on successive records', () => {
      svc.recordTestMetric('cpu', 10);
      svc.recordTestMetric('cpu', 20);
      expect(svc.getTimeSeries('cpu')!.values).toHaveLength(2);
    });

    it('caps time series at 100 points', () => {
      for (let i = 0; i < 110; i++) {
        svc.recordTestMetric('cpu', i);
      }
      expect(svc.getTimeSeries('cpu')!.values.length).toBe(100);
    });
  });

  // ── Snapshot ──────────────────────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('returns snapshot with correct service name', () => {
      const snap = svc.getSnapshot();
      expect(snap.serviceName).toBe('test-service');
    });

    it('snapshot metrics is empty initially', () => {
      expect(Object.keys(svc.getSnapshot().metrics)).toHaveLength(0);
    });

    it('snapshot includes recorded metrics with latest value', () => {
      svc.registerTestMetric({ name: 'latency', type: 'gauge', unit: 'ms' });
      svc.recordTestMetric('latency', 50);
      svc.recordTestMetric('latency', 80);

      const snap = svc.getSnapshot();
      expect(snap.metrics['latency']).toBeDefined();
      expect(snap.metrics['latency'].value).toBe(80);
      expect(snap.metrics['latency'].unit).toBe('ms');
      expect(snap.metrics['latency'].type).toBe('gauge');
    });

    it('snapshot includes time series arrays', () => {
      svc.recordTestMetric('mem', 100);
      const snap = svc.getSnapshot();
      expect(snap.timeSeries).toBeDefined();
      expect(snap.timeSeries!.some(ts => ts.name === 'mem')).toBe(true);
    });

    it('skips metric keys that have no values', () => {
      // Record then the key will exist; we test that empty entries are excluded
      // by checking that zero-value array keys won't appear (internal cap removes from front)
      const snap = svc.getSnapshot();
      expect(Object.keys(snap.metrics)).toHaveLength(0);
    });
  });

  // ── calculateStats ────────────────────────────────────────────────────────

  describe('calculateStats', () => {
    it('returns all-zero stats for empty array', () => {
      const stats = svc.exposedCalculateStats([]);
      expect(stats).toEqual({ min: 0, max: 0, avg: 0, sum: 0, count: 0, p50: 0, p90: 0, p95: 0, p99: 0 });
    });

    it('calculates stats for a single value', () => {
      const stats = svc.exposedCalculateStats([42]);
      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.avg).toBe(42);
      expect(stats.sum).toBe(42);
      expect(stats.count).toBe(1);
    });

    it('calculates correct min/max/avg/sum for multiple values', () => {
      const stats = svc.exposedCalculateStats([10, 20, 30, 40, 50]);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.avg).toBe(30);
      expect(stats.sum).toBe(150);
      expect(stats.count).toBe(5);
    });

    it('calculates percentiles on sorted data', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
      const stats = svc.exposedCalculateStats(values);
      expect(stats.p50).toBe(50);
      expect(stats.p90).toBe(90);
      expect(stats.p95).toBe(95);
      expect(stats.p99).toBe(99);
    });

    it('does not mutate the input array', () => {
      const input = [5, 3, 1, 4, 2];
      svc.exposedCalculateStats(input);
      expect(input).toEqual([5, 3, 1, 4, 2]);
    });
  });
});

// ---------------------------------------------------------------------------
// CustomMetricsCollector
// ---------------------------------------------------------------------------

describe('CustomMetricsCollector', () => {
  let collector: CustomMetricsCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    collector = new CustomMetricsCollector('custom', 1_000_000);
  });

  afterEach(() => {
    collector.stop();
    vi.useRealTimers();
  });

  it('has "custom" as the service name in snapshots', () => {
    expect(collector.getSnapshot().serviceName).toBe('custom');
  });

  it('accepts a custom name', () => {
    const named = new CustomMetricsCollector('my-metrics');
    expect(named.getSnapshot().serviceName).toBe('my-metrics');
    named.stop();
  });

  describe('addMetric / removeMetric', () => {
    it('registers and collects a sync metric collector', async () => {
      collector.addMetric('active_users', () => 42);
      await (collector as any).collect();
      expect(collector.getLatestValue('active_users')).toBe(42);
    });

    it('registers and collects an async metric collector', async () => {
      collector.addMetric('queue_depth', async () => 7);
      await (collector as any).collect();
      expect(collector.getLatestValue('queue_depth')).toBe(7);
    });

    it('removes a metric collector so it is no longer collected', async () => {
      collector.addMetric('temp', () => 99);
      collector.removeMetric('temp');
      await (collector as any).collect();
      expect(collector.getLatestValue('temp')).toBeUndefined();
    });

    it('stores metric definition metadata', async () => {
      collector.addMetric('errors', () => 0, { type: 'counter', unit: 'count', description: 'Error count' });
      await (collector as any).collect();
      const snap = collector.getSnapshot();
      expect(snap.metrics['errors'].type).toBe('counter');
    });

    it('emits error event when collector throws', async () => {
      const errHandler = vi.fn();
      collector.on('error', errHandler);
      collector.addMetric('bad_metric', () => { throw new Error('boom'); });
      await (collector as any).collect();
      expect(errHandler).toHaveBeenCalledWith(
        expect.objectContaining({ metric: 'bad_metric' })
      );
    });
  });

  describe('setMetric', () => {
    it('records a value for a named metric', () => {
      collector.setMetric('cpu', 75);
      expect(collector.getLatestValue('cpu')).toBe(75);
    });

    it('supports labels on setMetric', () => {
      collector.setMetric('cpu', 60, { core: '0' });
      collector.setMetric('cpu', 80, { core: '1' });
      expect(collector.getLatestValue('cpu', { core: '0' })).toBe(60);
      expect(collector.getLatestValue('cpu', { core: '1' })).toBe(80);
    });
  });

  describe('increment', () => {
    it('increments from 0 by default delta 1', () => {
      collector.increment('hits');
      expect(collector.getLatestValue('hits')).toBe(1);
    });

    it('increments by a custom delta', () => {
      collector.increment('hits', 5);
      collector.increment('hits', 3);
      expect(collector.getLatestValue('hits')).toBe(8);
    });

    it('supports labels on increment', () => {
      collector.increment('req', 1, { method: 'GET' });
      collector.increment('req', 1, { method: 'GET' });
      collector.increment('req', 1, { method: 'POST' });
      expect(collector.getLatestValue('req', { method: 'GET' })).toBe(2);
      expect(collector.getLatestValue('req', { method: 'POST' })).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// SystemResourceMonitor
// ---------------------------------------------------------------------------

describe('SystemResourceMonitor', () => {
  let monitor: SystemResourceMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new SystemResourceMonitor(1_000_000);
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it('starts and records heap metrics on collect', () => {
    monitor.start();
    expect(monitor.getLatestValue('heap_used_bytes')).toBeGreaterThan(0);
    expect(monitor.getLatestValue('heap_total_bytes')).toBeGreaterThan(0);
  });

  it('records memory_total_bytes and memory_used_bytes from os module', () => {
    monitor.start();
    // On a real Node.js environment these should be available
    const total = monitor.getLatestValue('memory_total_bytes');
    expect(total).toBeDefined();
    expect(total).toBeGreaterThan(0);
  });

  it('records cpu_usage_percent after a second collect', () => {
    monitor.start(); // onStart captures lastCpuUsage, collect() runs once
    (monitor as any).collect(); // second collect should calculate cpu%
    const cpu = monitor.getLatestValue('cpu_usage_percent');
    expect(cpu).toBeDefined();
    expect(cpu).toBeGreaterThanOrEqual(0);
    expect(cpu).toBeLessThanOrEqual(100);
  });

  it('records event_loop_lag_ms via setImmediate', async () => {
    vi.useRealTimers(); // need real timers for setImmediate
    monitor.stop();
    const realMonitor = new SystemResourceMonitor(1_000_000);
    realMonitor.start();
    // Let setImmediate run
    await new Promise(resolve => setImmediate(resolve));
    const lag = realMonitor.getLatestValue('event_loop_lag_ms');
    expect(lag).toBeDefined();
    expect(lag).toBeGreaterThanOrEqual(0);
    realMonitor.stop();
  });
});

// ---------------------------------------------------------------------------
// PrometheusCollector
// ---------------------------------------------------------------------------

describe('PrometheusCollector', () => {
  let prometheus: PrometheusCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    prometheus = new PrometheusCollector({
      endpoint: 'http://prometheus:9090',
      queries: [
        { name: 'http_requests_total', query: 'sum(rate(http_requests_total[5m]))' },
        { name: 'error_rate', query: 'sum(rate(errors_total[5m]))' },
      ],
      interval: 1_000_000,
      timeout: 2000,
    });
  });

  afterEach(() => {
    prometheus.stop();
    vi.useRealTimers();
  });

  it('registers metric definitions for each query', () => {
    const snap = prometheus.getSnapshot();
    // No values yet — but definitions are registered; verify via snapshot after collect
    expect(snap.serviceName).toBe('prometheus');
  });

  it('collects metric values from a successful Prometheus response', async () => {
    // Use empty metric objects so the metric key has no label suffix
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: { result: [{ metric: {}, value: [1234567890, '42.5'] }] },
      },
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: { result: [{ metric: {}, value: [1234567890, '0.1'] }] },
      },
    });

    await (prometheus as any).collect();

    expect(prometheus.getLatestValue('http_requests_total')).toBeCloseTo(42.5);
    expect(prometheus.getLatestValue('error_rate')).toBeCloseTo(0.1);
  });

  it('records metric with labels when Prometheus result includes metric labels', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: { result: [{ metric: { job: 'api' }, value: [0, '99'] }] },
      },
    });
    mockedAxios.get.mockResolvedValue({
      data: { status: 'success', data: { result: [] } },
    });

    await (prometheus as any).collect();

    expect(prometheus.getLatestValue('http_requests_total', { job: 'api' })).toBeCloseTo(99);
  });

  it('calls axios.get with correct endpoint and query param', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { status: 'success', data: { result: [] } },
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: { status: 'success', data: { result: [] } },
    });

    await (prometheus as any).collect();

    expect(mockedAxios.get).toHaveBeenCalledWith('http://prometheus:9090/api/v1/query', {
      params: { query: 'sum(rate(http_requests_total[5m]))' },
      timeout: 2000,
    });
  });

  it('skips recording when Prometheus returns no results', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'success', data: { result: [] } },
    });

    await (prometheus as any).collect();

    expect(prometheus.getLatestValue('http_requests_total')).toBeUndefined();
  });

  it('skips recording when Prometheus status is not success', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'error', data: { result: [] } },
    });

    await (prometheus as any).collect();

    expect(prometheus.getLatestValue('http_requests_total')).toBeUndefined();
  });

  it('emits error event when axios.get throws', async () => {
    const errHandler = vi.fn();
    prometheus.on('error', errHandler);
    mockedAxios.get.mockRejectedValueOnce(new Error('network error'));
    mockedAxios.get.mockResolvedValueOnce({
      data: { status: 'success', data: { result: [] } },
    });

    await (prometheus as any).collect();

    expect(errHandler).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'http_requests_total' })
    );
  });
});

// ---------------------------------------------------------------------------
// HttpEndpointMonitor
// ---------------------------------------------------------------------------

describe('HttpEndpointMonitor', () => {
  let monitor: HttpEndpointMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    monitor = new HttpEndpointMonitor({
      endpoints: [
        { name: 'api', url: 'http://api.example.com/health', expectedStatus: 200 },
        { name: 'frontend', url: 'http://app.example.com', method: 'GET' },
      ],
      interval: 1_000_000,
      timeout: 5000,
    });
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it('registers metrics for each endpoint', () => {
    // After a collect, snapshot should contain metrics
    expect(monitor.getSnapshot().serviceName).toBe('http-endpoints');
  });

  it('records response time, status code, and availability for a successful response', async () => {
    mockedAxios.mockResolvedValueOnce({ status: 200 });
    mockedAxios.mockResolvedValueOnce({ status: 200 });

    await (monitor as any).collect();

    expect(monitor.getLatestValue('api_response_time_ms')).toBeGreaterThanOrEqual(0);
    expect(monitor.getLatestValue('api_status_code')).toBe(200);
    expect(monitor.getLatestValue('api_available')).toBe(1);
  });

  it('marks endpoint unavailable when status does not match expectedStatus', async () => {
    mockedAxios.mockResolvedValueOnce({ status: 503 });
    mockedAxios.mockResolvedValueOnce({ status: 200 });

    await (monitor as any).collect();

    expect(monitor.getLatestValue('api_available')).toBe(0);
    expect(monitor.getLatestValue('api_status_code')).toBe(503);
  });

  it('marks endpoint available when no expectedStatus and status is 2xx-3xx', async () => {
    mockedAxios.mockResolvedValueOnce({ status: 200 });
    mockedAxios.mockResolvedValueOnce({ status: 301 });

    await (monitor as any).collect();

    expect(monitor.getLatestValue('frontend_available')).toBe(1);
  });

  it('marks endpoint available=0 and status=0 when request throws', async () => {
    mockedAxios.mockRejectedValueOnce(new Error('connection refused'));
    mockedAxios.mockResolvedValueOnce({ status: 200 });

    await (monitor as any).collect();

    expect(monitor.getLatestValue('api_available')).toBe(0);
    expect(monitor.getLatestValue('api_status_code')).toBe(0);
    expect(monitor.getLatestValue('api_response_time_ms')).toBeGreaterThanOrEqual(0);
  });

  it('uses default interval of 30000 when not provided', () => {
    const m = new HttpEndpointMonitor({ endpoints: [] });
    expect((m as any).collectionInterval).toBe(30000);
    m.stop();
  });
});

// ---------------------------------------------------------------------------
// DatabaseMonitor
// ---------------------------------------------------------------------------

describe('DatabaseMonitor', () => {
  let dbMonitor: DatabaseMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    dbMonitor = new DatabaseMonitor({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      interval: 1_000_000,
    });
  });

  afterEach(() => {
    dbMonitor.stop();
    vi.useRealTimers();
  });

  it('has "database" as service name', () => {
    expect(dbMonitor.getSnapshot().serviceName).toBe('database');
  });

  it('records db_available=1 and db_query_time_ms on successful collect', async () => {
    vi.useRealTimers();
    dbMonitor.stop();
    const realMonitor = new DatabaseMonitor({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      interval: 1_000_000,
    });

    await (realMonitor as any).collect();

    expect(realMonitor.getLatestValue('db_available')).toBe(1);
    expect(realMonitor.getLatestValue('db_query_time_ms')).toBeGreaterThanOrEqual(0);
    realMonitor.stop();
  });

  it('uses default interval of 10000 when not provided', () => {
    const m = new DatabaseMonitor({ connectionString: 'postgresql://localhost' });
    expect((m as any).collectionInterval).toBe(10000);
    m.stop();
  });
});

// ---------------------------------------------------------------------------
// ContextServiceManager
// ---------------------------------------------------------------------------

describe('ContextServiceManager', () => {
  let manager: ContextServiceManager;
  let svc1: CustomMetricsCollector;
  let svc2: CustomMetricsCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ContextServiceManager();
    svc1 = new CustomMetricsCollector('metrics-a', 1_000_000);
    svc2 = new CustomMetricsCollector('metrics-b', 1_000_000);
  });

  afterEach(() => {
    manager.stopAll();
    vi.useRealTimers();
  });

  describe('register / unregister', () => {
    it('registers a service successfully', () => {
      manager.register(svc1);
      expect(manager.get('metrics-a')).toBe(svc1);
    });

    it('throws when registering a service with the same name twice', () => {
      manager.register(svc1);
      const duplicate = new CustomMetricsCollector('metrics-a', 1_000_000);
      expect(() => manager.register(duplicate)).toThrow('Service metrics-a already registered');
      duplicate.stop();
    });

    it('unregisters a service and stops it', () => {
      manager.register(svc1);
      svc1.start();
      expect((svc1 as any).running).toBe(true);

      manager.unregister('metrics-a');
      expect(manager.get('metrics-a')).toBeUndefined();
      expect((svc1 as any).running).toBe(false);
    });

    it('unregister is a no-op for unknown service names', () => {
      expect(() => manager.unregister('nonexistent')).not.toThrow();
    });

    it('auto-starts a service registered while manager is running', () => {
      manager.startAll(); // manager is now "running"
      manager.register(svc1);
      expect((svc1 as any).running).toBe(true);
    });

    it('does not start service registered before startAll()', () => {
      manager.register(svc1);
      expect((svc1 as any).running).toBe(false);
    });
  });

  describe('get', () => {
    it('returns undefined for unknown service', () => {
      expect(manager.get('no-such')).toBeUndefined();
    });

    it('returns typed service via generic parameter', () => {
      manager.register(svc1);
      const retrieved = manager.get<CustomMetricsCollector>('metrics-a');
      expect(retrieved).toBeInstanceOf(CustomMetricsCollector);
    });
  });

  describe('startAll / stopAll', () => {
    it('starts all registered services', () => {
      manager.register(svc1);
      manager.register(svc2);
      manager.startAll();
      expect((svc1 as any).running).toBe(true);
      expect((svc2 as any).running).toBe(true);
    });

    it('stops all running services', () => {
      manager.register(svc1);
      manager.register(svc2);
      manager.startAll();
      manager.stopAll();
      expect((svc1 as any).running).toBe(false);
      expect((svc2 as any).running).toBe(false);
    });
  });

  describe('getAllSnapshots', () => {
    it('returns an empty object when no services are registered', () => {
      expect(manager.getAllSnapshots()).toEqual({});
    });

    it('returns snapshots keyed by service name', () => {
      manager.register(svc1);
      manager.register(svc2);
      const snapshots = manager.getAllSnapshots();
      expect(snapshots).toHaveProperty('metrics-a');
      expect(snapshots).toHaveProperty('metrics-b');
      expect(snapshots['metrics-a'].serviceName).toBe('metrics-a');
    });
  });

  describe('getAllMetrics', () => {
    it('returns empty object when no services have metrics', () => {
      manager.register(svc1);
      expect(manager.getAllMetrics()).toEqual({});
    });

    it('returns metrics namespaced by service name', () => {
      svc1.setMetric('requests', 100);
      manager.register(svc1);
      const metrics = manager.getAllMetrics();
      expect(metrics).toHaveProperty('metrics-a.requests');
      expect(metrics['metrics-a.requests'].value).toBe(100);
    });

    it('combines metrics from multiple services without collision', () => {
      svc1.setMetric('cpu', 50);
      svc2.setMetric('cpu', 75);
      manager.register(svc1);
      manager.register(svc2);
      const metrics = manager.getAllMetrics();
      expect(metrics['metrics-a.cpu'].value).toBe(50);
      expect(metrics['metrics-b.cpu'].value).toBe(75);
    });
  });
});

// ---------------------------------------------------------------------------
// createService factory
// ---------------------------------------------------------------------------

describe('createService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a PrometheusCollector for type "prometheus"', () => {
    const config: ServiceConfig = {
      name: 'prom',
      type: 'prometheus',
      interval: 1_000_000,
      config: { endpoint: 'http://prom:9090', queries: [] },
    };
    const svc = createService(config);
    expect(svc).toBeInstanceOf(PrometheusCollector);
    svc.stop();
  });

  it('creates a SystemResourceMonitor for type "system"', () => {
    vi.useFakeTimers();
    const svc = createService({ name: 'sys', type: 'system', interval: 1_000_000 });
    expect(svc).toBeInstanceOf(SystemResourceMonitor);
    svc.stop();
  });

  it('creates an HttpEndpointMonitor for type "http"', () => {
    const svc = createService({
      name: 'http',
      type: 'http',
      interval: 1_000_000,
      config: { endpoints: [] },
    });
    expect(svc).toBeInstanceOf(HttpEndpointMonitor);
    svc.stop();
  });

  it('creates a DatabaseMonitor for type "database"', () => {
    const svc = createService({
      name: 'db',
      type: 'database',
      interval: 1_000_000,
      config: { connectionString: 'postgresql://localhost' },
    });
    expect(svc).toBeInstanceOf(DatabaseMonitor);
    svc.stop();
  });

  it('creates a CustomMetricsCollector for type "custom"', () => {
    const svc = createService({ name: 'my-custom', type: 'custom', interval: 1_000_000 });
    expect(svc).toBeInstanceOf(CustomMetricsCollector);
    svc.stop();
  });

  it('throws for unknown service type', () => {
    expect(() =>
      createService({ name: 'x', type: 'unknown-type' as any })
    ).toThrow('Unknown service type: unknown-type');
  });

  it('uses config.config values for prometheus', () => {
    const svc = createService({
      name: 'p',
      type: 'prometheus',
      config: {
        endpoint: 'http://my-prom:9090',
        queries: [{ name: 'rps', query: 'rate(requests[1m])' }],
        timeout: 3000,
      },
    }) as PrometheusCollector;
    expect((svc as any).endpoint).toBe('http://my-prom:9090');
    expect((svc as any).timeout).toBe(3000);
    svc.stop();
  });
});
