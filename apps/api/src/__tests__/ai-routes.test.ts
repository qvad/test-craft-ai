/**
 * Vitest suite for AI routes (apps/api/src/modules/ai/routes.ts)
 * Uses fastify.inject() to exercise each route via HTTP simulation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('../modules/ai/ai-service.js', () => ({
  aiService: {
    generateCode: vi.fn(),
    generateData: vi.fn(),
    validateResponse: vi.fn(),
    detectAnomalies: vi.fn(),
  },
}));

vi.mock('../modules/ai/rag-service.js', () => ({
  ragService: {
    indexDocument: vi.fn(),
    search: vi.fn(),
    getDocument: vi.fn(),
    deleteDocument: vi.fn(),
    indexCodeExample: vi.fn(),
    indexAPIDoc: vi.fn(),
    indexDatabaseSchema: vi.fn(),
    exportDocuments: vi.fn(),
    importDocuments: vi.fn(),
    getStats: vi.fn(),
    clearAll: vi.fn(),
  },
}));

vi.mock('../modules/audit/audit.service.js', () => ({
  auditLog: {
    log: vi.fn().mockResolvedValue('audit-id'),
  },
}));

vi.mock('../common/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { aiRoutes } from '../modules/ai/routes.js';
import { aiService } from '../modules/ai/ai-service.js';
import { ragService } from '../modules/ai/rag-service.js';

const mockAiService = vi.mocked(aiService);
const mockRagService = vi.mocked(ragService);

// Mock fetch globally (used by /complete and /lm-studio/complete)
global.fetch = vi.fn();
const mockFetch = vi.mocked(global.fetch);

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(aiRoutes);
  await app.ready();
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

function mockFetchError(status: number, body: string) {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error('no body')),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// POST /complete (Claude API proxy)
// =============================================================================

describe('POST /complete', () => {
  const validBody = {
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('proxies request to Anthropic and returns response', async () => {
    const app = await buildApp();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const anthropicResponse = { content: [{ text: 'Hi there' }] };
    mockFetch.mockResolvedValueOnce(mockFetchOk(anthropicResponse));

    const res = await app.inject({ method: 'POST', url: '/complete', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(anthropicResponse);
    delete process.env.ANTHROPIC_API_KEY;
    await app.close();
  });

  it('returns 500 when no API key is configured', async () => {
    const app = await buildApp();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_API_KEY;

    const res = await app.inject({ method: 'POST', url: '/complete', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Anthropic API key not configured' });
    await app.close();
  });

  it('forwards Anthropic API errors with the upstream status code', async () => {
    const app = await buildApp();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    mockFetch.mockResolvedValueOnce(mockFetchError(429, 'rate limit exceeded'));

    const res = await app.inject({ method: 'POST', url: '/complete', payload: validBody });

    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: 'Claude API error' });
    delete process.env.ANTHROPIC_API_KEY;
    await app.close();
  });

  it('returns 400 on invalid body (missing messages)', async () => {
    const app = await buildApp();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const res = await app.inject({ method: 'POST', url: '/complete', payload: {} });

    expect(res.statusCode).toBe(400);
    delete process.env.ANTHROPIC_API_KEY;
    await app.close();
  });

  it('uses AI_API_KEY fallback when ANTHROPIC_API_KEY is absent', async () => {
    const app = await buildApp();
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_API_KEY = 'sk-fallback';

    mockFetch.mockResolvedValueOnce(mockFetchOk({ content: [] }));

    const res = await app.inject({ method: 'POST', url: '/complete', payload: validBody });

    expect(res.statusCode).toBe(200);
    delete process.env.AI_API_KEY;
    await app.close();
  });
});

// =============================================================================
// POST /generate/code
// =============================================================================

describe('POST /generate/code', () => {
  const validBody = {
    nodeId: 'node-1',
    nodeType: 'http-sampler',
    intent: 'Send a GET request to /api/users',
    language: 'python',
  };

  it('returns generated code on success', async () => {
    const app = await buildApp();
    const generated = { code: 'import requests\nrequests.get("/api/users")', language: 'python' };
    mockAiService.generateCode.mockResolvedValueOnce(generated as any);

    const res = await app.inject({ method: 'POST', url: '/generate/code', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(generated);
    expect(mockAiService.generateCode).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 'node-1',
      intent: validBody.intent,
      language: 'python',
    }));
    await app.close();
  });

  it('forwards optional context and options fields', async () => {
    const app = await buildApp();
    mockAiService.generateCode.mockResolvedValueOnce({ code: '// ok' } as any);

    const bodyWithExtras = {
      ...validBody,
      context: { testPlanId: 'plan-1', variables: { host: 'localhost' } },
      options: { temperature: 0.5, maxTokens: 2000, includeTests: true },
    };

    const res = await app.inject({ method: 'POST', url: '/generate/code', payload: bodyWithExtras });

    expect(res.statusCode).toBe(200);
    expect(mockAiService.generateCode).toHaveBeenCalledWith(expect.objectContaining({
      context: bodyWithExtras.context,
      options: bodyWithExtras.options,
    }));
    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/generate/code', payload: { nodeId: 'x' } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Validation error' });
    await app.close();
  });

  it('returns 500 when aiService throws', async () => {
    const app = await buildApp();
    mockAiService.generateCode.mockRejectedValueOnce(new Error('LLM timeout'));

    const res = await app.inject({ method: 'POST', url: '/generate/code', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Code generation failed' });
    await app.close();
  });
});

// =============================================================================
// POST /generate/data
// =============================================================================

describe('POST /generate/data', () => {
  const validBody = {
    schema: {
      fields: [
        { name: 'id', type: 'integer' },
        { name: 'email', type: 'string', format: 'email' },
      ],
    },
    count: 10,
  };

  it('returns generated data on success', async () => {
    const app = await buildApp();
    const generated = { data: [{ id: 1, email: 'a@b.com' }], count: 1 };
    mockAiService.generateData.mockResolvedValueOnce(generated as any);

    const res = await app.inject({ method: 'POST', url: '/generate/data', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(generated);
    await app.close();
  });

  it('returns 400 when count is missing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/generate/data',
      payload: { schema: { fields: [] } },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when count exceeds maximum (10000)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/generate/data',
      payload: { ...validBody, count: 99999 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when aiService throws', async () => {
    const app = await buildApp();
    mockAiService.generateData.mockRejectedValueOnce(new Error('model error'));

    const res = await app.inject({ method: 'POST', url: '/generate/data', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Data generation failed' });
    await app.close();
  });
});

// =============================================================================
// POST /validate
// =============================================================================

describe('POST /validate', () => {
  const validBody = {
    response: { status: 200, body: '{"ok":true}' },
    intent: 'Should return 200 with ok flag',
    expectedBehavior: 'HTTP 200 with JSON body',
  };

  it('returns validation result on success', async () => {
    const app = await buildApp();
    const result = { valid: true, confidence: 0.95, explanation: 'Matches expected behavior' };
    mockAiService.validateResponse.mockResolvedValueOnce(result as any);

    const res = await app.inject({ method: 'POST', url: '/validate', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(result);
    await app.close();
  });

  it('accepts optional rules array', async () => {
    const app = await buildApp();
    mockAiService.validateResponse.mockResolvedValueOnce({ valid: true } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: { ...validBody, rules: ['status must be 200', 'body must be JSON'] },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAiService.validateResponse).toHaveBeenCalledWith(
      expect.objectContaining({ rules: ['status must be 200', 'body must be JSON'] })
    );
    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/validate', payload: { response: {} } });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when aiService throws', async () => {
    const app = await buildApp();
    mockAiService.validateResponse.mockRejectedValueOnce(new Error('service down'));

    const res = await app.inject({ method: 'POST', url: '/validate', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Validation failed' });
    await app.close();
  });
});

// =============================================================================
// POST /anomalies/detect
// =============================================================================

describe('POST /anomalies/detect', () => {
  const validBody = {
    metrics: [
      { timestamp: '2025-01-01T00:00:00Z', name: 'response_time', value: 120 },
      { timestamp: '2025-01-01T00:01:00Z', name: 'response_time', value: 950 },
    ],
    sensitivity: 'medium' as const,
  };

  it('returns anomaly detection results on success', async () => {
    const app = await buildApp();
    const result = { anomalies: [{ index: 1, score: 0.9, reason: 'spike' }] };
    mockAiService.detectAnomalies.mockResolvedValueOnce(result as any);

    const res = await app.inject({ method: 'POST', url: '/anomalies/detect', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(result);
    await app.close();
  });

  it('accepts baselineWindow optional field', async () => {
    const app = await buildApp();
    mockAiService.detectAnomalies.mockResolvedValueOnce({ anomalies: [] } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/anomalies/detect',
      payload: { ...validBody, baselineWindow: 60 },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAiService.detectAnomalies).toHaveBeenCalledWith(
      expect.objectContaining({ baselineWindow: 60 })
    );
    await app.close();
  });

  it('returns 400 when sensitivity is invalid', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/anomalies/detect',
      payload: { ...validBody, sensitivity: 'extreme' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when metrics array is missing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/anomalies/detect',
      payload: { sensitivity: 'high' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when aiService throws', async () => {
    const app = await buildApp();
    mockAiService.detectAnomalies.mockRejectedValueOnce(new Error('model timeout'));

    const res = await app.inject({ method: 'POST', url: '/anomalies/detect', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Anomaly detection failed' });
    await app.close();
  });
});

// =============================================================================
// POST /rag/documents (index document)
// =============================================================================

describe('POST /rag/documents', () => {
  const validBody = {
    id: 'doc-1',
    content: 'This is a test document about HTTP samplers',
    metadata: { type: 'guide', language: 'en' },
  };

  it('indexes document and returns 201 with id', async () => {
    const app = await buildApp();
    mockRagService.indexDocument.mockResolvedValueOnce({ id: 'doc-1' } as any);

    const res = await app.inject({ method: 'POST', url: '/rag/documents', payload: validBody });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: 'doc-1', indexed: true });
    await app.close();
  });

  it('defaults metadata to {} when not provided', async () => {
    const app = await buildApp();
    mockRagService.indexDocument.mockResolvedValueOnce({ id: 'doc-2' } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/documents',
      payload: { id: 'doc-2', content: 'minimal doc' },
    });

    expect(res.statusCode).toBe(201);
    expect(mockRagService.indexDocument).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} })
    );
    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/rag/documents', payload: { id: 'x' } });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.indexDocument.mockRejectedValueOnce(new Error('DB error'));

    const res = await app.inject({ method: 'POST', url: '/rag/documents', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Indexing failed' });
    await app.close();
  });
});

// =============================================================================
// POST /rag/search
// =============================================================================

describe('POST /rag/search', () => {
  const validBody = { query: 'HTTP sampler examples' };

  it('returns search results on success', async () => {
    const app = await buildApp();
    const results = { results: [{ id: 'doc-1', score: 0.9, content: 'example' }], total: 1 };
    mockRagService.search.mockResolvedValueOnce(results as any);

    const res = await app.inject({ method: 'POST', url: '/rag/search', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(results);
    await app.close();
  });

  it('passes topK and filters to service', async () => {
    const app = await buildApp();
    mockRagService.search.mockResolvedValueOnce({ results: [], total: 0 } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/search',
      payload: { query: 'test', topK: 10, filters: { language: 'python' } },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRagService.search).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 10, filters: { language: 'python' } })
    );
    await app.close();
  });

  it('returns 400 when topK exceeds maximum (100)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/search',
      payload: { query: 'test', topK: 200 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when query is missing', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/rag/search', payload: {} });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.search.mockRejectedValueOnce(new Error('search failed'));

    const res = await app.inject({ method: 'POST', url: '/rag/search', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Search failed' });
    await app.close();
  });
});

// =============================================================================
// GET /rag/documents/:id
// =============================================================================

describe('GET /rag/documents/:id', () => {
  it('returns document when found', async () => {
    const app = await buildApp();
    const doc = { id: 'doc-1', content: 'test', metadata: {} };
    mockRagService.getDocument.mockResolvedValueOnce(doc as any);

    const res = await app.inject({ method: 'GET', url: '/rag/documents/doc-1' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(doc);
    expect(mockRagService.getDocument).toHaveBeenCalledWith('doc-1');
    await app.close();
  });

  it('returns 404 when document not found', async () => {
    const app = await buildApp();
    mockRagService.getDocument.mockResolvedValueOnce(null);

    const res = await app.inject({ method: 'GET', url: '/rag/documents/nonexistent' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Document not found' });
    await app.close();
  });
});

// =============================================================================
// DELETE /rag/documents/:id
// =============================================================================

describe('DELETE /rag/documents/:id', () => {
  it('deletes document and returns 204', async () => {
    const app = await buildApp();
    mockRagService.deleteDocument.mockResolvedValueOnce(true);

    const res = await app.inject({ method: 'DELETE', url: '/rag/documents/doc-1' });

    expect(res.statusCode).toBe(204);
    expect(mockRagService.deleteDocument).toHaveBeenCalledWith('doc-1');
    await app.close();
  });

  it('returns 404 when document does not exist', async () => {
    const app = await buildApp();
    mockRagService.deleteDocument.mockResolvedValueOnce(false);

    const res = await app.inject({ method: 'DELETE', url: '/rag/documents/nonexistent' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Document not found' });
    await app.close();
  });
});

// =============================================================================
// POST /lm-studio/complete (LM Studio proxy + SSRF protection)
// =============================================================================

describe('POST /lm-studio/complete', () => {
  const validBody = {
    endpoint: 'https://external-llm.example.com/v1/chat/completions',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('proxies request to external LM Studio endpoint', async () => {
    const app = await buildApp();
    const lmResponse = { choices: [{ message: { content: 'Hi' } }] };
    mockFetch.mockResolvedValueOnce(mockFetchOk(lmResponse));

    const res = await app.inject({ method: 'POST', url: '/lm-studio/complete', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(lmResponse);
    await app.close();
  });

  it('blocks localhost (SSRF protection)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/lm-studio/complete',
      payload: { ...validBody, endpoint: 'http://localhost:11434/v1/chat/completions' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid endpoint URL' });
    await app.close();
  });

  it('blocks private IP addresses (SSRF protection)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/lm-studio/complete',
      payload: { ...validBody, endpoint: 'http://192.168.1.100/api' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid endpoint URL' });
    await app.close();
  });

  it('blocks cloud metadata endpoint (SSRF protection)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/lm-studio/complete',
      payload: { ...validBody, endpoint: 'http://169.254.169.254/latest/meta-data/' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid endpoint URL' });
    await app.close();
  });

  it('blocks non-http(s) protocols (SSRF protection)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/lm-studio/complete',
      payload: { ...validBody, endpoint: 'ftp://external.com/resource' },
    });

    // ftp:// is not a valid URL per zod's .url() validator, so 400 either way
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('blocks blocked ports (SSRF protection)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/lm-studio/complete',
      payload: { ...validBody, endpoint: 'https://external.example.com:5432/api' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid endpoint URL' });
    await app.close();
  });

  it('forwards upstream API errors', async () => {
    const app = await buildApp();
    mockFetch.mockResolvedValueOnce(mockFetchError(503, 'service unavailable'));

    const res = await app.inject({ method: 'POST', url: '/lm-studio/complete', payload: validBody });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: 'LM Studio API error' });
    await app.close();
  });

  it('returns 400 on invalid body', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/lm-studio/complete', payload: {} });

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

// =============================================================================
// POST /rag/code-examples
// =============================================================================

describe('POST /rag/code-examples', () => {
  const validBody = {
    id: 'ex-1',
    language: 'python',
    nodeType: 'http-sampler',
    description: 'Send GET request',
    code: 'import requests\nrequests.get("/")',
  };

  it('indexes code example and returns 201', async () => {
    const app = await buildApp();
    mockRagService.indexCodeExample.mockResolvedValueOnce(undefined);

    const res = await app.inject({ method: 'POST', url: '/rag/code-examples', payload: validBody });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ indexed: true });
    expect(mockRagService.indexCodeExample).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ex-1',
      language: 'python',
    }));
    await app.close();
  });

  it('accepts optional tags', async () => {
    const app = await buildApp();
    mockRagService.indexCodeExample.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/code-examples',
      payload: { ...validBody, tags: ['http', 'rest'] },
    });

    expect(res.statusCode).toBe(201);
    expect(mockRagService.indexCodeExample).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['http', 'rest'] })
    );
    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/code-examples',
      payload: { id: 'ex-1', language: 'python' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.indexCodeExample.mockRejectedValueOnce(new Error('DB down'));

    const res = await app.inject({ method: 'POST', url: '/rag/code-examples', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Indexing failed' });
    await app.close();
  });
});

// =============================================================================
// POST /rag/api-docs
// =============================================================================

describe('POST /rag/api-docs', () => {
  const validBody = {
    id: 'api-doc-1',
    endpoint: '/api/v1/users',
    method: 'GET' as const,
    description: 'List all users',
  };

  it('indexes API doc and returns 201', async () => {
    const app = await buildApp();
    mockRagService.indexAPIDoc.mockResolvedValueOnce(undefined);

    const res = await app.inject({ method: 'POST', url: '/rag/api-docs', payload: validBody });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ indexed: true });
    await app.close();
  });

  it('accepts optional requestSchema, responseSchema, and examples', async () => {
    const app = await buildApp();
    mockRagService.indexAPIDoc.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/api-docs',
      payload: {
        ...validBody,
        requestSchema: { type: 'object' },
        responseSchema: { type: 'array' },
        examples: [{ request: {}, response: [] }],
      },
    });

    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('returns 400 for invalid HTTP method', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/api-docs',
      payload: { ...validBody, method: 'INVALID' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/api-docs',
      payload: { id: 'api-1' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.indexAPIDoc.mockRejectedValueOnce(new Error('storage error'));

    const res = await app.inject({ method: 'POST', url: '/rag/api-docs', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Indexing failed' });
    await app.close();
  });
});

// =============================================================================
// POST /rag/db-schemas
// =============================================================================

describe('POST /rag/db-schemas', () => {
  const validBody = {
    id: 'schema-1',
    tableName: 'users',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'email', type: 'varchar', description: 'User email' },
    ],
  };

  it('indexes DB schema and returns 201', async () => {
    const app = await buildApp();
    mockRagService.indexDatabaseSchema.mockResolvedValueOnce(undefined);

    const res = await app.inject({ method: 'POST', url: '/rag/db-schemas', payload: validBody });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ indexed: true });
    await app.close();
  });

  it('accepts optional relationships', async () => {
    const app = await buildApp();
    mockRagService.indexDatabaseSchema.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/db-schemas',
      payload: { ...validBody, relationships: [{ table: 'orders', type: 'has_many' }] },
    });

    expect(res.statusCode).toBe(201);
    expect(mockRagService.indexDatabaseSchema).toHaveBeenCalledWith(
      expect.objectContaining({ relationships: [{ table: 'orders', type: 'has_many' }] })
    );
    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/db-schemas',
      payload: { id: 'schema-1' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.indexDatabaseSchema.mockRejectedValueOnce(new Error('write error'));

    const res = await app.inject({ method: 'POST', url: '/rag/db-schemas', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Indexing failed' });
    await app.close();
  });
});

// =============================================================================
// GET /rag/export
// =============================================================================

describe('GET /rag/export', () => {
  it('exports all documents and sets Content-Disposition header', async () => {
    const app = await buildApp();
    const exportData = { version: '1.0', documents: [{ id: 'doc-1' }] };
    mockRagService.exportDocuments.mockResolvedValueOnce(exportData as any);

    const res = await app.inject({ method: 'GET', url: '/rag/export' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(exportData);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="rag-export-/);
    await app.close();
  });

  it('passes type filter when provided', async () => {
    const app = await buildApp();
    mockRagService.exportDocuments.mockResolvedValueOnce({ version: '1.0', documents: [] } as any);

    const res = await app.inject({ method: 'GET', url: '/rag/export?type=code-example' });

    expect(res.statusCode).toBe(200);
    expect(mockRagService.exportDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { type: 'code-example' } })
    );
    await app.close();
  });

  it('passes includeEmbeddings=true when requested', async () => {
    const app = await buildApp();
    mockRagService.exportDocuments.mockResolvedValueOnce({ version: '1.0', documents: [] } as any);

    const res = await app.inject({ method: 'GET', url: '/rag/export?includeEmbeddings=true' });

    expect(res.statusCode).toBe(200);
    expect(mockRagService.exportDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ includeEmbeddings: true })
    );
    await app.close();
  });

  it('does not pass filters when no type query param', async () => {
    const app = await buildApp();
    mockRagService.exportDocuments.mockResolvedValueOnce({ version: '1.0', documents: [] } as any);

    await app.inject({ method: 'GET', url: '/rag/export' });

    expect(mockRagService.exportDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ filters: undefined })
    );
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.exportDocuments.mockRejectedValueOnce(new Error('export failed'));

    const res = await app.inject({ method: 'GET', url: '/rag/export' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Export failed' });
    await app.close();
  });
});

// =============================================================================
// POST /rag/import
// =============================================================================

describe('POST /rag/import', () => {
  const validBody = {
    version: '1.0',
    documents: [
      { id: 'doc-1', content: 'text', metadata: {} },
    ],
  };

  it('imports documents and returns result', async () => {
    const app = await buildApp();
    const importResult = { imported: 1, skipped: 0, errors: [] };
    mockRagService.importDocuments.mockResolvedValueOnce(importResult as any);

    const res = await app.inject({ method: 'POST', url: '/rag/import', payload: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(importResult);
    await app.close();
  });

  it('passes overwrite=true query param to service', async () => {
    const app = await buildApp();
    mockRagService.importDocuments.mockResolvedValueOnce({ imported: 1, skipped: 0 } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/import?overwrite=true',
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    expect(mockRagService.importDocuments).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ overwrite: true })
    );
    await app.close();
  });

  it('passes regenerateEmbeddings=true query param to service', async () => {
    const app = await buildApp();
    mockRagService.importDocuments.mockResolvedValueOnce({ imported: 1, skipped: 0 } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/rag/import?regenerateEmbeddings=true',
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    expect(mockRagService.importDocuments).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ regenerateEmbeddings: true })
    );
    await app.close();
  });

  it('returns 400 when version is missing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/import',
      payload: { documents: validBody.documents },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid import format' });
    await app.close();
  });

  it('returns 400 when documents is not an array', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rag/import',
      payload: { version: '1.0', documents: 'not-an-array' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid import format' });
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.importDocuments.mockRejectedValueOnce(new Error('import failed'));

    const res = await app.inject({ method: 'POST', url: '/rag/import', payload: validBody });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Import failed' });
    await app.close();
  });
});

// =============================================================================
// GET /rag/stats
// =============================================================================

describe('GET /rag/stats', () => {
  it('returns stats on success', async () => {
    const app = await buildApp();
    const stats = { totalDocuments: 42, byType: { 'code-example': 30, 'api-doc': 12 } };
    mockRagService.getStats.mockResolvedValueOnce(stats as any);

    const res = await app.inject({ method: 'GET', url: '/rag/stats' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(stats);
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.getStats.mockRejectedValueOnce(new Error('stats query failed'));

    const res = await app.inject({ method: 'GET', url: '/rag/stats' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Failed to get stats' });
    await app.close();
  });
});

// =============================================================================
// DELETE /rag/documents (clear all)
// =============================================================================

describe('DELETE /rag/documents (clear all)', () => {
  it('clears all documents and returns deleted count', async () => {
    const app = await buildApp();
    mockRagService.clearAll.mockResolvedValueOnce(99);

    const res = await app.inject({ method: 'DELETE', url: '/rag/documents' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: 99 });
    await app.close();
  });

  it('returns 500 when ragService throws', async () => {
    const app = await buildApp();
    mockRagService.clearAll.mockRejectedValueOnce(new Error('clear failed'));

    const res = await app.inject({ method: 'DELETE', url: '/rag/documents' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Clear failed' });
    await app.close();
  });
});
