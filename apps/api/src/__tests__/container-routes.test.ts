/**
 * Vitest suite for container routes (apps/api/src/modules/containers/routes.ts)
 * Uses fastify.inject() to exercise each route via HTTP simulation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockOrchestrator = vi.hoisted(() => ({
  getPoolStatus: vi.fn(),
}));

vi.mock('../modules/containers/orchestrator.js', () => ({
  orchestrator: mockOrchestrator,
}));

vi.mock('../common/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { containersRoutes } from '../modules/containers/routes.js';
import { SUPPORTED_LANGUAGES, LANGUAGE_INFO } from '../modules/containers/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPoolStatus(overrides: Record<string, { ready: number; total: number }> = {}) {
  const status: Record<string, { ready: number; total: number }> = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    status[lang] = { ready: 0, total: 0 };
  }
  return { ...status, ...overrides };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(containersRoutes, { prefix: '/api/v1/containers' });
  await app.ready();
  return app;
}

// ── Test setup ────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildApp();
});

// ── GET /languages ────────────────────────────────────────────────────────────

describe('GET /api/v1/containers/languages', () => {
  it('returns all supported languages with available=false when pools are empty', async () => {
    mockOrchestrator.getPoolStatus.mockResolvedValue(buildPoolStatus());

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/languages' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('languages');
    expect(body.languages).toHaveLength(SUPPORTED_LANGUAGES.length);

    for (const lang of body.languages) {
      expect(lang).toHaveProperty('available', false);
      expect(lang).toHaveProperty('pool');
      expect(lang.pool).toMatchObject({ ready: 0, total: 0 });
    }
  });

  it('marks a language as available when pool has ready pods', async () => {
    mockOrchestrator.getPoolStatus.mockResolvedValue(
      buildPoolStatus({ python: { ready: 2, total: 3 } })
    );

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/languages' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const python = body.languages.find((l: any) => l.language === 'python');
    expect(python).toBeDefined();
    expect(python.available).toBe(true);
    expect(python.pool).toEqual({ ready: 2, total: 3 });
  });

  it('includes LANGUAGE_INFO fields for each language', async () => {
    mockOrchestrator.getPoolStatus.mockResolvedValue(buildPoolStatus());

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/languages' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const java = body.languages.find((l: any) => l.language === 'java');
    expect(java).toMatchObject({
      ...LANGUAGE_INFO.java,
      available: false,
    });
  });

  it('defaults pool to { ready: 0, total: 0 } when language is missing from pool status', async () => {
    // Return only partial status (no java entry)
    const partial: Record<string, { ready: number; total: number }> = {};
    for (const lang of SUPPORTED_LANGUAGES.filter((l) => l !== 'java')) {
      partial[lang] = { ready: 0, total: 0 };
    }
    mockOrchestrator.getPoolStatus.mockResolvedValue(partial);

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/languages' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const java = body.languages.find((l: any) => l.language === 'java');
    expect(java.pool).toEqual({ ready: 0, total: 0 });
    expect(java.available).toBe(false);
  });
});

// ── GET /pools ────────────────────────────────────────────────────────────────

describe('GET /api/v1/containers/pools', () => {
  it('returns all pool statuses', async () => {
    const status = buildPoolStatus({ go: { ready: 1, total: 1 } });
    mockOrchestrator.getPoolStatus.mockResolvedValue(status);

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/pools' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('pools');
    expect(body.pools).toEqual(status);
  });

  it('returns 500 when orchestrator throws', async () => {
    mockOrchestrator.getPoolStatus.mockRejectedValue(new Error('k8s unavailable'));

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/pools' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Failed to get pool status' });
  });
});

// ── GET /pools/:language ──────────────────────────────────────────────────────

describe('GET /api/v1/containers/pools/:language', () => {
  it('returns pool status for a valid language', async () => {
    mockOrchestrator.getPoolStatus.mockResolvedValue(
      buildPoolStatus({ rust: { ready: 3, total: 5 } })
    );

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/pools/rust' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      ready: 3,
      total: 5,
      ...LANGUAGE_INFO.rust,
    });
  });

  it('returns 400 for an unsupported language', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/pools/cobol' });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Unsupported language: cobol' });
  });

  it('returns 500 when orchestrator throws', async () => {
    mockOrchestrator.getPoolStatus.mockRejectedValue(new Error('network error'));

    const res = await app.inject({ method: 'GET', url: '/api/v1/containers/pools/java' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Failed to get pool status' });
  });

  it('works for every supported language', async () => {
    mockOrchestrator.getPoolStatus.mockResolvedValue(buildPoolStatus());

    for (const lang of SUPPORTED_LANGUAGES) {
      const res = await app.inject({ method: 'GET', url: `/api/v1/containers/pools/${lang}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('language', lang);
    }
  });
});

// ── POST /pools/:language/scale ───────────────────────────────────────────────

describe('POST /api/v1/containers/pools/:language/scale', () => {
  it('returns scaling confirmation for a valid language and replica count', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/containers/pools/python/scale',
      payload: { replicas: 3 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      language: 'python',
      targetReplicas: 3,
    });
    expect(body.message).toContain('python');
    expect(body.message).toContain('3');
  });

  it('returns 400 for an unsupported language', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/containers/pools/cobol/scale',
      payload: { replicas: 2 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Unsupported language: cobol' });
  });

  it('returns 400 when replicas is negative', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/containers/pools/java/scale',
      payload: { replicas: -1 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Replicas must be between 0 and 10' });
  });

  it('returns 400 when replicas exceeds 10', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/containers/pools/java/scale',
      payload: { replicas: 11 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Replicas must be between 0 and 10' });
  });

  it('accepts boundary values 0 and 10', async () => {
    for (const replicas of [0, 10]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/containers/pools/go/scale',
        payload: { replicas },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ language: 'go', targetReplicas: replicas });
    }
  });
});
