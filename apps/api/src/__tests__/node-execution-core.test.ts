/**
 * Unit tests for testing/routes.ts — http-request and database-request node types.
 * Uses fastify.inject() so the full request/response lifecycle is exercised.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';

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
  default: {
    Client: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Subject under test (imported after mocks are in place)
// ---------------------------------------------------------------------------

import { testingRoutes } from '../modules/testing/routes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

global.fetch = vi.fn();

/**
 * Build a mock Response-like object for global.fetch.
 * body can be any value — it will be JSON-serialised unless it is already a string.
 */
function mockFetchResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  const defaultStatusText: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request',
    401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error',
  };
  const statusText = defaultStatusText[status] ?? 'Unknown';
  const allHeaders = { 'content-type': 'application/json', ...extraHeaders };

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(bodyText),
    headers: { entries: () => Object.entries(allHeaders) },
  } as unknown as Response;
}

/** Build a mock pg.Client instance with pre-programmed responses. */
function buildPgClientMock(opts: {
  connectError?: Error;
  queryResult?: { rowCount: number; rows: unknown[]; fields: { name: string; dataTypeID: number }[] };
  queryError?: Error;
}) {
  const mock = {
    connect: opts.connectError
      ? vi.fn().mockRejectedValueOnce(opts.connectError)
      : vi.fn().mockResolvedValueOnce(undefined),
    query: opts.queryError
      ? vi.fn().mockRejectedValueOnce(opts.queryError)
      : vi.fn().mockResolvedValueOnce(
          opts.queryResult ?? { rowCount: 0, rows: [], fields: [] },
        ),
    end: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(pg.Client).mockImplementationOnce(() => mock as unknown as pg.Client);
  return mock;
}

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
});

// ===========================================================================
// http-request node
// ===========================================================================

describe('http-request node', () => {
  it('returns success status and parsed JSON body for a 200 GET', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockFetchResponse(200, { users: [{ id: 1 }] }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'api.example.com', path: '/users' },
        inputs: {},
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('http-request');
    expect(body.output.statusCode).toBe(200);
    expect(body.output.body).toEqual({ users: [{ id: 1 }] });
    expect(body.duration).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('returns error status and error message for a 404 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockFetchResponse(404, { message: 'not found' }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'api.example.com', path: '/missing' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('error');
    expect(body.output.statusCode).toBe(404);
    expect(body.error).toContain('404');
  });

  it('includes port in URL when port is not 80 or 443', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'http', serverName: 'localhost', port: 8080, path: '/health' },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/health');
  });

  it('omits port from URL when port is 443', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'api.example.com', port: 443, path: '/api' },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api');
    expect(url).not.toContain(':443');
  });

  it('omits port from URL when port is 80', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'http', serverName: 'example.com', port: 80, path: '/' },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(':80');
  });

  it('appends query parameters to the URL', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, []));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: {
          method: 'GET',
          protocol: 'https',
          serverName: 'api.example.com',
          path: '/search',
          parameters: [
            { name: 'q', value: 'hello world' },
            { name: 'limit', value: '10' },
          ],
        },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('?');
    expect(url).toContain('q=hello+world');
    expect(url).toContain('limit=10');
  });

  it('sends body for POST requests', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(201, { id: 42 }));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: {
          method: 'POST',
          protocol: 'https',
          serverName: 'api.example.com',
          path: '/users',
          bodyData: JSON.stringify({ name: 'Alice' }),
          headers: { 'Content-Type': 'application/json' },
        },
        inputs: {},
      },
    });

    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ name: 'Alice' }));
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('does not send body for GET requests', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: {
          method: 'GET',
          protocol: 'https',
          serverName: 'api.example.com',
          path: '/users',
          bodyData: 'should-be-ignored',
        },
        inputs: {},
      },
    });

    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(opts.body).toBeUndefined();
  });

  it('returns timeout status when fetch is aborted', async () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: {
          method: 'GET', protocol: 'https', serverName: 'slow.example.com', path: '/wait',
          responseTimeout: 1,
        },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('timeout');
    expect(body.output.timedOut).toBe(true);
    expect(body.error).toContain('timed out');
  });

  it('returns error status on network failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'down.example.com', path: '/' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('error');
    expect(body.error).toBe('ECONNREFUSED');
  });

  it('substitutes ${varName} patterns from inputs into config', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: {
          method: 'GET',
          protocol: 'https',
          serverName: '${targetHost}',
          path: '/api/${version}/items',
        },
        inputs: { targetHost: 'myapi.example.com', version: 'v3' },
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://myapi.example.com/api/v3/items');
  });

  it('leaves unresolved ${var} patterns unchanged when variable is absent', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: {
          method: 'GET', protocol: 'https', serverName: '${unknownVar}', path: '/',
        },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('${unknownVar}');
  });

  it('returns plain-text body when response is not JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'plain text'));

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'example.com', path: '/text' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.output.body).toBe('plain text');
  });

  it('includes metrics object with requestCount, bytesReceived, bytesSent, latencyMs', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'example.com', path: '/' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.metrics.requestCount).toBe(1);
    expect(typeof body.metrics.bytesReceived).toBe('number');
    expect(typeof body.metrics.bytesSent).toBe('number');
    expect(typeof body.metrics.latencyMs).toBe('number');
  });

  it('defaults to https protocol when protocol is omitted', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', serverName: 'example.com', path: '/ping' },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\//);
  });

  it('defaults to / when path is omitted', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(200, 'ok'));

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'http-request',
        config: { method: 'GET', protocol: 'https', serverName: 'example.com' },
        inputs: {},
      },
    });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/$/u);
  });
});

// ===========================================================================
// database-request node
// ===========================================================================

describe('database-request node', () => {
  it('returns success with rows, rowCount and fields on successful query', async () => {
    buildPgClientMock({
      queryResult: {
        rowCount: 2,
        rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 25 },
        ],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: {
          host: 'db.example.com', port: 5432, database: 'mydb',
          user: 'postgres', password: 'secret',
          query: 'SELECT id, name FROM users',
        },
        inputs: {},
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.output.rowCount).toBe(2);
    expect(body.output.rows).toHaveLength(2);
    expect(body.output.rows[0].name).toBe('Alice');
    expect(body.output.fields).toHaveLength(2);
    expect(body.output.fields[0].name).toBe('id');
  });

  it('includes host, port and database in the output', async () => {
    buildPgClientMock({ queryResult: { rowCount: 0, rows: [], fields: [] } });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: {
          host: 'db.example.com', port: 5433, database: 'production',
          query: 'SELECT 1',
        },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.output.host).toBe('db.example.com');
    expect(body.output.port).toBe(5433);
    expect(body.output.database).toBe('production');
  });

  it('uses default host/port/database/user/password when config omits them', async () => {
    buildPgClientMock({ queryResult: { rowCount: 0, rows: [], fields: [] } });

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: { query: 'SELECT 1' },
        inputs: {},
      },
    });

    const ctorArg = vi.mocked(pg.Client).mock.calls[0][0] as Record<string, unknown>;
    expect(ctorArg.host).toBe('localhost');
    expect(ctorArg.port).toBe(5433);
    expect(ctorArg.database).toBe('testcraft');
    expect(ctorArg.user).toBe('yugabyte');
    expect(ctorArg.password).toBe('yugabyte');
  });

  it('passes query parameters to pg.Client.query()', async () => {
    const mock = buildPgClientMock({
      queryResult: { rowCount: 1, rows: [{ id: 42 }], fields: [] },
    });

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: {
          query: 'SELECT * FROM users WHERE id = $1',
          parameters: [42],
        },
        inputs: {},
      },
    });

    expect(mock.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [42]);
  });

  it('calls client.end() after a successful query', async () => {
    const mock = buildPgClientMock({ queryResult: { rowCount: 0, rows: [], fields: [] } });

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: { query: 'SELECT 1' },
        inputs: {},
      },
    });

    expect(mock.end).toHaveBeenCalled();
  });

  it('returns error status when connect() fails', async () => {
    buildPgClientMock({ connectError: new Error('ECONNREFUSED 127.0.0.1:5432') });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: { host: 'localhost', port: 5432, database: 'mydb', user: 'pg', password: 'pg', query: 'SELECT 1' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('error');
    expect(body.error).toContain('ECONNREFUSED');
  });

  it('returns error status when query() fails and still calls client.end()', async () => {
    const mock = buildPgClientMock({
      queryError: new Error('relation "nonexistent" does not exist'),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: { query: 'SELECT * FROM nonexistent' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('error');
    expect(body.error).toContain('nonexistent');
    expect(mock.end).toHaveBeenCalled();
  });

  it('also works for yugabyte-request node type', async () => {
    buildPgClientMock({ queryResult: { rowCount: 1, rows: [{ version: '2.18' }], fields: [] } });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'yugabyte-request',
        config: { query: 'SELECT version()' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('yugabyte-request');
    expect(body.output.rows[0].version).toBe('2.18');
  });

  it('also works for postgresql-request node type', async () => {
    buildPgClientMock({ queryResult: { rowCount: 0, rows: [], fields: [] } });

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'postgresql-request',
        config: { query: 'SELECT 1' },
        inputs: {},
      },
    });

    const body = res.json();
    expect(body.status).toBe('success');
    expect(body.nodeType).toBe('postgresql-request');
  });

  it('substitutes ${varName} patterns from inputs into query config', async () => {
    const mock = buildPgClientMock({ queryResult: { rowCount: 0, rows: [], fields: [] } });

    await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {
        nodeType: 'database-request',
        config: { query: 'SELECT * FROM ${tableName} LIMIT 10' },
        inputs: { tableName: 'orders' },
      },
    });

    expect(mock.query).toHaveBeenCalledWith(
      'SELECT * FROM orders LIMIT 10',
      [],
    );
  });
});
