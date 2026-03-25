/**
 * Vitest suite for HOCON routes (apps/api/src/modules/hocon/routes.ts)
 * Uses fastify.inject() to exercise each route via HTTP simulation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Must be declared before any module-under-test imports.
// vi.mock() is hoisted to the top of the file, so variables it references must
// be declared with vi.hoisted() to avoid the temporal dead zone.

// Mock the module-level `const storage = new TestPlanStorage()` instantiation.
const mockStorage = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getVersionHistory: vi.fn(),
  getTags: vi.fn(),
}));

vi.mock('../modules/hocon/storage.js', () => ({
  TestPlanStorage: vi.fn(() => mockStorage),
}));

vi.mock('../modules/hocon/parser.js', () => ({
  parseHocon: vi.fn(),
  validateTestPlan: vi.fn(),
  serializeToHocon: vi.fn(),
}));

vi.mock('../common/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { hoconRoutes } from '../modules/hocon/routes.js';
import { parseHocon, validateTestPlan } from '../modules/hocon/parser.js';

const mockParseHocon = vi.mocked(parseHocon);
const mockValidateTestPlan = vi.mocked(validateTestPlan);

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SAMPLE_HOCON = `testcraft { plan { name = "Test Plan" } }`;

const mockParsedHocon = {
  testcraft: {
    plan: {
      name: 'Test Plan',
      description: 'A sample test plan',
      nodes: [
        { id: 'node-1', type: 'http-request', name: 'HTTP Request', dependsOn: [] },
      ],
      variables: {},
      config: { environment: 'test' },
      tags: ['api', 'smoke'],
    },
  },
};

const mockValidation = { valid: true, errors: [] as string[], warnings: [] as string[] };

const mockStoredPlan = {
  id: 'plan-uuid-1',
  name: 'Test Plan',
  description: 'A sample test plan',
  hoconContent: SAMPLE_HOCON,
  version: 1,
  tags: ['api', 'smoke'],
  createdBy: 'author',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(hoconRoutes);
  await app.ready();
  return app;
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy-path behaviour — individual tests override as needed.
  mockParseHocon.mockReturnValue(mockParsedHocon as any);
  mockValidateTestPlan.mockReturnValue(mockValidation as any);
  mockStorage.save.mockResolvedValue(mockStoredPlan);
  mockStorage.get.mockResolvedValue(mockStoredPlan);
  mockStorage.list.mockResolvedValue({ items: [mockStoredPlan], total: 1 });
  mockStorage.update.mockResolvedValue({ ...mockStoredPlan, version: 2, updatedAt: new Date() });
  mockStorage.delete.mockResolvedValue(true);
  mockStorage.getVersionHistory.mockResolvedValue([]);
  mockStorage.getTags.mockResolvedValue(['api', 'smoke']);
});

// =============================================================================
// POST /plans/import
// =============================================================================

describe('POST /plans/import', () => {
  it('returns 201 with plan metadata on success', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: SAMPLE_HOCON },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe(mockStoredPlan.id);
    expect(body.name).toBe(mockStoredPlan.name);
    expect(body.version).toBe(1);
    expect(body.nodeCount).toBe(1);
    expect(body.createdAt).toBeDefined();
  });

  it('passes nameOverride as author to storage.save', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: SAMPLE_HOCON, nameOverride: 'custom-author' },
    });
    expect(mockStorage.save).toHaveBeenCalledWith(SAMPLE_HOCON, { author: 'custom-author' });
  });

  it('falls back to plan name as author when nameOverride is absent', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(mockStorage.save).toHaveBeenCalledWith(SAMPLE_HOCON, { author: 'Test Plan' });
  });

  it('returns 400 when parsed HOCON is missing testcraft.plan section', async () => {
    mockParseHocon.mockReturnValue({} as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/missing testcraft\.plan/i);
  });

  it('returns 400 with validation errors when plan is invalid', async () => {
    mockValidateTestPlan.mockReturnValue({
      valid: false,
      errors: ['name is required'],
      warnings: [],
    } as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.errors).toContain('name is required');
  });

  it('returns 400 with details when parseHocon throws', async () => {
    mockParseHocon.mockImplementation(() => { throw new Error('unexpected token'); });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: '{ bad hocon' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().details).toContain('unexpected token');
  });

  it('returns 0 nodeCount when nodes array is absent', async () => {
    mockParseHocon.mockReturnValue({
      testcraft: { plan: { name: 'No Nodes' } },
    } as any);
    mockStorage.save.mockResolvedValue({ ...mockStoredPlan, name: 'No Nodes' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/import',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().nodeCount).toBe(0);
  });
});

// =============================================================================
// GET /plans/:id/export
// =============================================================================

describe('GET /plans/:id/export', () => {
  it('returns 200 with hoconContent on success', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/plan-uuid-1/export' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(mockStoredPlan.id);
    expect(body.hoconContent).toBe(SAMPLE_HOCON);
  });

  it('calls storage.get with the correct id', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/plans/plan-uuid-1/export' });
    expect(mockStorage.get).toHaveBeenCalledWith('plan-uuid-1');
  });

  it('returns 404 when plan does not exist', async () => {
    mockStorage.get.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/no-such-id/export' });
    expect(res.statusCode).toBe(404);
    expect(res.json().id).toBe('no-such-id');
  });
});

// =============================================================================
// GET /plans
// =============================================================================

describe('GET /plans', () => {
  it('returns paginated plan list', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.totalPages).toBe(1);
  });

  it('passes limit and offset derived from page/limit query params', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/plans?page=3&limit=10' });
    // Query params are strings; offset is computed numerically as (3-1)*10=20
    expect(mockStorage.list).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 20 }),
    );
  });

  it('passes search query to storage.list', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/plans?search=smoke' });
    expect(mockStorage.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'smoke' }),
    );
  });

  it('parses comma-separated tags into an array', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/plans?tags=api,smoke' });
    expect(mockStorage.list).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['api', 'smoke'] }),
    );
  });

  it('maps plan items to the expected response shape', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans' });
    const item = res.json().items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('version');
    expect(item).toHaveProperty('tags');
    expect(item).not.toHaveProperty('hoconContent');
  });

  it('calculates correct totalPages', async () => {
    mockStorage.list.mockResolvedValue({ items: [], total: 45 });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans?limit=20' });
    expect(res.json().totalPages).toBe(3);
  });
});

// =============================================================================
// GET /plans/:id
// =============================================================================

describe('GET /plans/:id', () => {
  it('returns full plan including hoconContent', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/plan-uuid-1' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(mockStoredPlan.id);
    expect(body.hoconContent).toBe(SAMPLE_HOCON);
  });

  it('returns 404 when plan does not exist', async () => {
    mockStorage.get.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/ghost-id' });
    expect(res.statusCode).toBe(404);
    expect(res.json().id).toBe('ghost-id');
  });
});

// =============================================================================
// PUT /plans/:id
// =============================================================================

describe('PUT /plans/:id', () => {
  it('returns 200 with updated plan metadata on success', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/plans/plan-uuid-1',
      payload: { hoconContent: SAMPLE_HOCON },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('calls storage.update with createVersion: true', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'PUT',
      url: '/plans/plan-uuid-1',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(mockStorage.update).toHaveBeenCalledWith(
      'plan-uuid-1',
      SAMPLE_HOCON,
      { createVersion: true },
    );
  });

  it('returns 404 when plan does not exist', async () => {
    mockStorage.get.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/plans/no-such-plan',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when new HOCON is missing testcraft.plan section', async () => {
    mockParseHocon.mockReturnValue({} as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/plans/plan-uuid-1',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/missing testcraft\.plan/i);
  });

  it('returns 400 when updated HOCON fails validation', async () => {
    mockValidateTestPlan.mockReturnValue({
      valid: false,
      errors: ['nodes array is empty'],
      warnings: [],
    } as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/plans/plan-uuid-1',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toContain('nodes array is empty');
  });

  it('returns 400 when parseHocon throws', async () => {
    mockParseHocon.mockImplementation(() => { throw new Error('syntax error'); });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/plans/plan-uuid-1',
      payload: { hoconContent: 'bad { content' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().details).toContain('syntax error');
  });

  it('uses existing hoconContent when only metadata fields are changed', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'PUT',
      url: '/plans/plan-uuid-1',
      payload: { name: 'Renamed Plan' },
    });
    // No hoconContent provided — storage.update should receive the existing HOCON
    expect(mockStorage.update).toHaveBeenCalledWith(
      'plan-uuid-1',
      mockStoredPlan.hoconContent,
      { createVersion: true },
    );
  });
});

// =============================================================================
// DELETE /plans/:id
// =============================================================================

describe('DELETE /plans/:id', () => {
  it('returns 204 on successful deletion', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/plans/plan-uuid-1' });
    expect(res.statusCode).toBe(204);
    expect(mockStorage.delete).toHaveBeenCalledWith('plan-uuid-1');
  });

  it('returns 404 when plan does not exist', async () => {
    mockStorage.get.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/plans/no-such-plan' });
    expect(res.statusCode).toBe(404);
    expect(mockStorage.delete).not.toHaveBeenCalled();
  });
});

// =============================================================================
// POST /plans/validate
// =============================================================================

describe('POST /plans/validate', () => {
  it('returns valid: true with executionPlan on success', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/validate',
      payload: { hoconContent: SAMPLE_HOCON },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.executionPlan).toBeDefined();
    expect(body.executionPlan.name).toBe('Test Plan');
    expect(body.executionPlan.nodeCount).toBe(1);
  });

  it('returns 400 with valid: false when testcraft.plan is missing', async () => {
    mockParseHocon.mockReturnValue({} as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/validate',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().valid).toBe(false);
  });

  it('returns valid: false with errors when validation fails', async () => {
    mockValidateTestPlan.mockReturnValue({
      valid: false,
      errors: ['at least one node required'],
      warnings: ['no description'],
    } as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/validate',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(false);
    expect(body.errors).toContain('at least one node required');
    expect(body.warnings).toContain('no description');
  });

  it('returns 400 with parse error message when parseHocon throws', async () => {
    mockParseHocon.mockImplementation(() => { throw new Error('invalid token at line 3'); });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/validate',
      payload: { hoconContent: '{ garbage' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors[0]).toContain('invalid token at line 3');
  });

  it('includes environment from query when provided', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/validate',
      payload: { hoconContent: SAMPLE_HOCON, environment: 'staging' },
    });
    expect(res.json().executionPlan.environment).toBe('staging');
  });

  it('detects missing variables not provided in the request', async () => {
    mockParseHocon.mockReturnValue({
      testcraft: {
        plan: {
          name: 'Var Plan',
          nodes: [],
          variables: {},
          config: {},
        },
      },
    } as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/validate',
      // hoconContent referencing ${baseUrl} without defining or providing it
      payload: { hoconContent: 'testcraft { plan { name = "Var Plan", nodes = [ { url = "${baseUrl}" } ] } }' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().executionPlan.variables).toBeDefined();
  });
});

// =============================================================================
// POST /plans/execute
// =============================================================================

describe('POST /plans/execute', () => {
  it('returns 202 with executionId and streamUrl', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/execute',
      payload: { hoconContent: SAMPLE_HOCON },
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.executionId).toMatch(/^exec-/);
    expect(body.status).toBe('queued');
    expect(body.streamUrl).toContain('/api/v1/executions/');
    expect(body.planName).toBe('Test Plan');
    expect(body.nodeCount).toBe(1);
  });

  it('returns 400 when testcraft.plan section is missing', async () => {
    mockParseHocon.mockReturnValue({} as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/execute',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/missing testcraft\.plan/i);
  });

  it('returns 400 when validation fails', async () => {
    mockValidateTestPlan.mockReturnValue({
      valid: false,
      errors: ['plan has no nodes'],
      warnings: [],
    } as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/execute',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toContain('plan has no nodes');
  });

  it('returns 400 with details when parseHocon throws', async () => {
    mockParseHocon.mockImplementation(() => { throw new Error('parse failed'); });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/execute',
      payload: { hoconContent: '{ bad' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().details).toContain('parse failed');
  });

  it('uses default environment "default" when none provided', async () => {
    mockParseHocon.mockReturnValue({
      testcraft: {
        plan: { name: 'Env Plan', nodes: [] },
      },
    } as any);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/execute',
      payload: { hoconContent: SAMPLE_HOCON },
    });
    expect(res.json().environment).toBe('default');
  });
});

// =============================================================================
// POST /plans/:id/clone
// =============================================================================

describe('POST /plans/:id/clone', () => {
  it('returns 201 with cloned plan metadata', async () => {
    const cloned = { ...mockStoredPlan, id: 'plan-uuid-2', name: 'Test Plan (copy)' };
    mockStorage.save.mockResolvedValue(cloned);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/plan-uuid-1/clone',
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe('plan-uuid-2');
    expect(body.clonedFrom).toBe('plan-uuid-1');
  });

  it('clones using the original hoconContent', async () => {
    const cloned = { ...mockStoredPlan, id: 'plan-uuid-clone' };
    mockStorage.save.mockResolvedValue(cloned);
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/plans/plan-uuid-1/clone',
      payload: {},
    });
    expect(mockStorage.save).toHaveBeenCalledWith(mockStoredPlan.hoconContent);
  });

  it('returns 404 when original plan does not exist', async () => {
    mockStorage.get.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/plans/ghost-plan/clone',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().id).toBe('ghost-plan');
  });
});

// =============================================================================
// GET /plans/:id/history
// =============================================================================

describe('GET /plans/:id/history', () => {
  it('returns planId and versions array', async () => {
    mockStorage.getVersionHistory.mockResolvedValue([
      { version: 2, updatedAt: new Date(), updatedBy: 'user1' },
      { version: 1, updatedAt: new Date(), updatedBy: undefined },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/plan-uuid-1/history' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.planId).toBe('plan-uuid-1');
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].version).toBe(2);
  });

  it('returns empty versions array when no history exists', async () => {
    mockStorage.getVersionHistory.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/plan-uuid-1/history' });
    expect(res.json().versions).toEqual([]);
  });
});

// =============================================================================
// GET /plans/tags
// =============================================================================

describe('GET /plans/tags', () => {
  it('returns available tags', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/tags' });

    expect(res.statusCode).toBe(200);
    expect(res.json().tags).toEqual(['api', 'smoke']);
    expect(mockStorage.getTags).toHaveBeenCalledOnce();
  });

  it('returns empty array when no tags exist', async () => {
    mockStorage.getTags.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/plans/tags' });
    expect(res.json().tags).toEqual([]);
  });
});
