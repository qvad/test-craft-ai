/**
 * Unit tests for MetricsRegistry in metrics.service.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database client before importing the module
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'ok', latency: 5 }),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    metrics: {
      enabled: true,
      path: '/metrics',
      collectDefaultMetrics: true,
    },
  },
}));

// Mock logger
vi.mock('../common/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import { metricsRegistry } from '../modules/metrics/metrics.service.js';
import { db } from '../modules/database/yugabyte-client.js';

const mockDb = vi.mocked(db);

describe('MetricsRegistry', () => {
  beforeEach(() => {
    metricsRegistry.reset();
    vi.clearAllMocks();
  });

  // ── Counter ──────────────────────────────────────────────────────────────

  describe('incCounter', () => {
    it('increments an existing counter by 1 by default', () => {
      metricsRegistry.incCounter('http_requests_total', { method: 'GET', path: '/', status: '200' });
      metricsRegistry.incCounter('http_requests_total', { method: 'GET', path: '/', status: '200' });

      // We verify via getMetrics output
      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_total{method="GET",path="/",status="200"} 2');
      });
    });

    it('increments by a custom value', () => {
      metricsRegistry.incCounter('http_requests_total', { method: 'POST', path: '/api', status: '201' }, 5);

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_total{method="POST",path="/api",status="201"} 5');
      });
    });

    it('tracks different label sets independently', () => {
      metricsRegistry.incCounter('http_requests_total', { method: 'GET', path: '/', status: '200' }, 3);
      metricsRegistry.incCounter('http_requests_total', { method: 'POST', path: '/', status: '500' }, 2);

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_total{method="GET",path="/",status="200"} 3');
        expect(output).toContain('http_requests_total{method="POST",path="/",status="500"} 2');
      });
    });

    it('is a no-op for an unknown metric name', () => {
      // Should not throw
      expect(() => metricsRegistry.incCounter('nonexistent_counter', {})).not.toThrow();
    });

    it('is a no-op when called on a gauge metric name', () => {
      // http_requests_in_flight is a gauge; calling incCounter on it should be silently ignored
      metricsRegistry.incCounter('http_requests_in_flight', { method: 'GET' });
      return metricsRegistry.getMetrics().then(output => {
        // The gauge line should not appear with a value from incCounter
        // (gauge starts empty after reset, so no label line for it)
        expect(output).not.toContain('http_requests_in_flight{method="GET"} 1');
      });
    });
  });

  // ── Gauge ─────────────────────────────────────────────────────────────────

  describe('setGauge', () => {
    it('sets a gauge value', () => {
      metricsRegistry.setGauge('http_requests_in_flight', 42, { method: 'GET' });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_in_flight{method="GET"} 42');
      });
    });

    it('overwrites the existing gauge value', () => {
      metricsRegistry.setGauge('http_requests_in_flight', 10, { method: 'GET' });
      metricsRegistry.setGauge('http_requests_in_flight', 7, { method: 'GET' });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_in_flight{method="GET"} 7');
        // ensure value "10" is gone
        expect(output).not.toContain('http_requests_in_flight{method="GET"} 10');
      });
    });

    it('is a no-op for a counter metric', () => {
      expect(() => metricsRegistry.setGauge('http_requests_total', 5, {})).not.toThrow();
    });
  });

  describe('incGauge', () => {
    it('increments a gauge', () => {
      metricsRegistry.incGauge('http_requests_in_flight', { method: 'DELETE' });
      metricsRegistry.incGauge('http_requests_in_flight', { method: 'DELETE' });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_in_flight{method="DELETE"} 2');
      });
    });
  });

  describe('decGauge', () => {
    it('decrements a gauge', () => {
      metricsRegistry.incGauge('http_requests_in_flight', { method: 'PUT' }, 5);
      metricsRegistry.decGauge('http_requests_in_flight', { method: 'PUT' }, 2);

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_in_flight{method="PUT"} 3');
      });
    });

    it('can decrement below zero', () => {
      metricsRegistry.decGauge('http_requests_in_flight', { method: 'HEAD' }, 1);

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_requests_in_flight{method="HEAD"} -1');
      });
    });
  });

  // ── Histogram ─────────────────────────────────────────────────────────────

  describe('observeHistogram', () => {
    it('records _count, _sum, and bucket entries', () => {
      metricsRegistry.observeHistogram('http_request_duration_seconds', 0.05, {
        method: 'GET',
        path: '/',
        status: '200',
      });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_request_duration_seconds_count{method="GET",path="/",status="200"} 1');
        expect(output).toContain('http_request_duration_seconds_sum{method="GET",path="/",status="200"} 0.05');
        // 0.05 <= 0.05, so this bucket should be present
        expect(output).toContain('http_request_duration_seconds_bucket{method="GET",path="/",status="200",le="0.05"} 1');
        // +Inf bucket always 1 after one observation
        expect(output).toContain('http_request_duration_seconds_bucket{method="GET",path="/",status="200",le="+Inf"} 1');
      });
    });

    it('accumulates count and sum across multiple observations', () => {
      const labels = { method: 'POST', path: '/exec', status: '200' };
      metricsRegistry.observeHistogram('http_request_duration_seconds', 0.1, labels);
      metricsRegistry.observeHistogram('http_request_duration_seconds', 0.3, labels);

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('http_request_duration_seconds_count{method="POST",path="/exec",status="200"} 2');
        // sum = 0.1 + 0.3 = 0.4
        expect(output).toMatch(
          /http_request_duration_seconds_sum\{method="POST",path="\/exec",status="200"\} 0\.4/
        );
      });
    });

    it('only counts a value in buckets <= the observed value', () => {
      metricsRegistry.observeHistogram('http_request_duration_seconds', 0.3, {
        method: 'GET',
        path: '/slow',
        status: '200',
      });

      return metricsRegistry.getMetrics().then(output => {
        // 0.3 > 0.25, so le=0.25 bucket should NOT be present (or value 0 but not present here)
        // 0.3 <= 0.5, so le=0.5 must be present
        expect(output).toContain(
          'http_request_duration_seconds_bucket{method="GET",path="/slow",status="200",le="0.5"} 1'
        );
        // 0.3 > 0.25 so le="0.25" bucket should not appear (value was never pushed for that bucket)
        expect(output).not.toContain(
          'http_request_duration_seconds_bucket{method="GET",path="/slow",status="200",le="0.25"} 1'
        );
      });
    });

    it('is a no-op for a non-histogram metric', () => {
      expect(() =>
        metricsRegistry.observeHistogram('http_requests_total', 1.5, {})
      ).not.toThrow();
    });

    it('supports custom bucket boundaries', () => {
      metricsRegistry.register({
        name: 'custom_histogram',
        help: 'A custom histogram',
        type: 'histogram',
      });
      metricsRegistry.setHistogramBuckets('custom_histogram', [1, 5, 10]);

      metricsRegistry.observeHistogram('custom_histogram', 3, {});

      return metricsRegistry.getMetrics().then(output => {
        // 3 > 1 → le=1 bucket absent
        expect(output).not.toContain('custom_histogram_bucket{le="1"} 1');
        // 3 <= 5 → le=5 bucket present
        expect(output).toContain('custom_histogram_bucket{le="5"} 1');
        // le=+Inf always present
        expect(output).toContain('custom_histogram_bucket{le="+Inf"} 1');
      });
    });
  });

  // ── getMetrics output format ───────────────────────────────────────────────

  describe('getMetrics', () => {
    it('includes HELP and TYPE lines for registered metrics', () => {
      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('# HELP http_requests_total Total number of HTTP requests');
        expect(output).toContain('# TYPE http_requests_total counter');
        expect(output).toContain('# HELP http_request_duration_seconds HTTP request duration in seconds');
        expect(output).toContain('# TYPE http_request_duration_seconds histogram');
      });
    });

    it('ends with a trailing newline', () => {
      return metricsRegistry.getMetrics().then(output => {
        expect(output.endsWith('\n')).toBe(true);
      });
    });

    it('includes process metrics', () => {
      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('# HELP process_resident_memory_bytes');
        expect(output).toContain('# HELP process_heap_bytes');
        expect(output).toContain('# HELP process_start_time_seconds');
        expect(output).toContain('nodejs_version_info');
      });
    });

    it('includes db_connection_healthy = 1 when DB is healthy', () => {
      mockDb.healthCheck.mockResolvedValueOnce({ status: 'ok', latency: 3 });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('db_connection_healthy 1');
        expect(output).toContain('db_query_latency_ms 3');
      });
    });

    it('includes db_connection_healthy = 0 when DB reports error', () => {
      mockDb.healthCheck.mockResolvedValueOnce({ status: 'error', latency: 0, message: 'timeout' });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('db_connection_healthy 0');
      });
    });

    it('skips DB metrics gracefully when healthCheck throws', () => {
      mockDb.healthCheck.mockRejectedValueOnce(new Error('DB unavailable'));

      return metricsRegistry.getMetrics().then(output => {
        // Should not contain DB health metrics but must not throw
        expect(output).not.toContain('db_connection_healthy');
        // Process metrics should still be present
        expect(output).toContain('process_resident_memory_bytes');
      });
    });

    it('formats labels correctly for a counter with multiple label values', () => {
      metricsRegistry.incCounter('auth_attempts_total', { type: 'password', result: 'success' });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('auth_attempts_total{type="password",result="success"} 1');
      });
    });

    it('outputs no label string for an entry with no labels', () => {
      metricsRegistry.register({ name: 'bare_counter', help: 'No labels', type: 'counter' });
      metricsRegistry.incCounter('bare_counter', {});

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('bare_counter 1');
      });
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all recorded values', () => {
      metricsRegistry.incCounter('http_requests_total', { method: 'GET', path: '/', status: '200' }, 10);
      metricsRegistry.reset();

      return metricsRegistry.getMetrics().then(output => {
        // After reset, no data lines for the counter
        expect(output).not.toContain('http_requests_total{method="GET"');
      });
    });

    it('does not remove metric definitions — new values can be recorded after reset', () => {
      metricsRegistry.incCounter('db_queries_total', { operation: 'select' }, 3);
      metricsRegistry.reset();
      metricsRegistry.incCounter('db_queries_total', { operation: 'select' }, 1);

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('db_queries_total{operation="select"} 1');
      });
    });
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('allows registering a new metric and recording values', () => {
      metricsRegistry.register({
        name: 'custom_test_gauge',
        help: 'A test gauge',
        type: 'gauge',
        labels: ['env'],
      });

      metricsRegistry.setGauge('custom_test_gauge', 99, { env: 'test' });

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('# HELP custom_test_gauge A test gauge');
        expect(output).toContain('# TYPE custom_test_gauge gauge');
        expect(output).toContain('custom_test_gauge{env="test"} 99');
      });
    });
  });

  // ── setHistogramBuckets ───────────────────────────────────────────────────

  describe('setHistogramBuckets', () => {
    it('sorts buckets before storing them', () => {
      metricsRegistry.register({
        name: 'sorted_histogram',
        help: 'Sorted buckets histogram',
        type: 'histogram',
      });
      metricsRegistry.setHistogramBuckets('sorted_histogram', [10, 1, 5]);

      // Observe a value of 4 — should fall in le=5 bucket only
      metricsRegistry.observeHistogram('sorted_histogram', 4, {});

      return metricsRegistry.getMetrics().then(output => {
        expect(output).toContain('sorted_histogram_bucket{le="5"} 1');
        expect(output).not.toContain('sorted_histogram_bucket{le="1"} 1');
      });
    });
  });
});
