/**
 * Unit tests for testing/routes.ts — constant-timer, uniform-random-timer,
 * loop-controller, and if-controller node types.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger side-effects
// ---------------------------------------------------------------------------

vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn(),
    deletePod: vi.fn(),
    waitForPodReady: vi.fn(),
    execInPod: vi.fn(),
    copyToPod: vi.fn(),
    getAvailableRunner: vi.fn().mockResolvedValue(null),
    listPods: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('pg', () => ({
  default: { Client: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { testingRoutes } from '../modules/testing/routes.js';

// ---------------------------------------------------------------------------
// Shared Fastify instance
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(testingRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ===========================================================================
// constant-timer node
// ===========================================================================

describe('constant-timer node', () => {
  it('returns success with actualDelay equal to configured delay', async () => {
    vi.useFakeTimers();

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'constant-timer',
        config: { delay: 500 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('constant-timer');
    expect(body.output.actualDelay).toBe(500);
  });

  it('defaults to 0ms delay when delay is omitted', async () => {
    vi.useFakeTimers();

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'constant-timer',
        config: {},
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.output.actualDelay).toBe(0);
  });

  it('defaults to 0ms delay when delay is a non-numeric string', async () => {
    vi.useFakeTimers();

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'constant-timer',
        config: { delay: 'notanumber' },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.output.actualDelay).toBe(0);
  });

  it('accepts delay as a string digit', async () => {
    vi.useFakeTimers();

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'constant-timer',
        config: { delay: '1000' },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.output.actualDelay).toBe(1000);
  });

  it('includes duration and logs fields in response', async () => {
    vi.useFakeTimers();

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'constant-timer',
        config: { delay: 100 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(typeof body.duration).toBe('number');
    expect(body.duration).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('substitutes ${varName} from inputs into delay config', async () => {
    vi.useFakeTimers();

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'constant-timer',
        config: { delay: '${waitTime}' },
        inputs: { waitTime: '250' },
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.output.actualDelay).toBe(250);
  });
});

// ===========================================================================
// uniform-random-timer node
// ===========================================================================

describe('uniform-random-timer node', () => {
  it('returns success with actualDelay, baseDelay, and range in output', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'uniform-random-timer',
        config: { delay: 200, range: 100 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('uniform-random-timer');
    expect(body.output.baseDelay).toBe(200);
    expect(body.output.range).toBe(100);
    // actualDelay = 200 + 0.5 * 100 = 250
    expect(body.output.actualDelay).toBe(250);
  });

  it('actualDelay is baseDelay when random returns 0', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'uniform-random-timer',
        config: { delay: 300, range: 200 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.output.actualDelay).toBe(300);
  });

  it('actualDelay is baseDelay + range when random returns 1', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'uniform-random-timer',
        config: { delay: 100, range: 400 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.output.actualDelay).toBe(500);
  });

  it('defaults baseDelay and range to 0 when omitted', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'uniform-random-timer',
        config: {},
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(body.output.baseDelay).toBe(0);
    expect(body.output.range).toBe(0);
    expect(body.output.actualDelay).toBe(0);
  });

  it('returns rounded integer for actualDelay', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.333);

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'uniform-random-timer',
        config: { delay: 100, range: 90 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    // actualDelay = 100 + 0.333 * 90 = 129.97 → rounds to 130
    expect(body.output.actualDelay).toBe(Math.round(100 + 0.333 * 90));
    expect(Number.isInteger(body.output.actualDelay)).toBe(true);
  });

  it('includes duration and logs in response', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const promise = app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'uniform-random-timer',
        config: { delay: 50, range: 50 },
        inputs: {},
      },
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    const body = res.json();
    expect(typeof body.duration).toBe('number');
    expect(Array.isArray(body.logs)).toBe(true);
  });
});

// ===========================================================================
// loop-controller node
// ===========================================================================

describe('loop-controller node', () => {
  it('returns success with numeric loopCount and iterations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: { loopCount: 5 },
        inputs: {},
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('loop-controller');
    expect(body.output.loopCount).toBe(5);
    expect(body.output.iterations).toBe(5);
  });

  it('sets loopCount to -1 and iterations to "infinite" when loopCount is "forever"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: { loopCount: 'forever' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.output.loopCount).toBe(-1);
    expect(body.output.iterations).toBe('infinite');
  });

  it('defaults to 0 iterations when loopCount is omitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: {},
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.loopCount).toBe(0);
    expect(body.output.iterations).toBe(0);
  });

  it('defaults to 0 when loopCount is a non-numeric string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: { loopCount: 'invalid' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.loopCount).toBe(0);
    expect(body.output.iterations).toBe(0);
  });

  it('accepts loopCount as a numeric string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: { loopCount: '10' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.loopCount).toBe(10);
    expect(body.output.iterations).toBe(10);
  });

  it('includes duration and logs in response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: { loopCount: 3 },
        inputs: {},
      },
    });

    const body = res.json();
    expect(typeof body.duration).toBe('number');
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('handles loopCount of 1 correctly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'loop-controller',
        config: { loopCount: 1 },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.loopCount).toBe(1);
    expect(body.output.iterations).toBe(1);
  });
});

// ===========================================================================
// if-controller node
// ===========================================================================

describe('if-controller node', () => {
  it('returns willExecuteChildren=true when condition is truthy and useExpression=false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: 'some string', useExpression: false },
        inputs: {},
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('if-controller');
    expect(body.output.result).toBe(true);
    expect(body.output.willExecuteChildren).toBe(true);
  });

  it('returns willExecuteChildren=false when condition is empty string and useExpression=false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: '', useExpression: false },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.result).toBe(false);
    expect(body.output.willExecuteChildren).toBe(false);
  });

  it('returns willExecuteChildren=true when condition is "true" and useExpression=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: 'true', useExpression: true },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.output.result).toBe(true);
    expect(body.output.willExecuteChildren).toBe(true);
  });

  it('returns willExecuteChildren=true when condition is "1" and useExpression=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: '1', useExpression: true },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.result).toBe(true);
    expect(body.output.willExecuteChildren).toBe(true);
  });

  it('returns willExecuteChildren=false when condition is "false" and useExpression=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: 'false', useExpression: true },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.result).toBe(false);
    expect(body.output.willExecuteChildren).toBe(false);
  });

  it('returns willExecuteChildren=false when condition is "0" and useExpression=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: '0', useExpression: true },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.result).toBe(false);
    expect(body.output.willExecuteChildren).toBe(false);
  });

  it('echoes the original condition value in output', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: 'myCondition', useExpression: false },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.condition).toBe('myCondition');
  });

  it('returns willExecuteChildren=false when condition is omitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { useExpression: false },
        inputs: {},
      },
    });

    const body = res.json();
    // undefined is falsy → Boolean(undefined) = false
    expect(body.output.result).toBe(false);
    expect(body.output.willExecuteChildren).toBe(false);
  });

  it('useExpression=false treats any non-empty string as true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: 'false', useExpression: false },
        inputs: {},
      },
    });

    const body = res.json();
    // Boolean('false') === true because it's a non-empty string
    expect(body.output.result).toBe(true);
    expect(body.output.willExecuteChildren).toBe(true);
  });

  it('includes duration and logs in response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'if-controller',
        config: { condition: 'true', useExpression: true },
        inputs: {},
      },
    });

    const body = res.json();
    expect(typeof body.duration).toBe('number');
    expect(Array.isArray(body.logs)).toBe(true);
  });
});
