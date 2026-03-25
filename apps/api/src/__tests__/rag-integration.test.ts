/**
 * Tests for RAG Service count query parameter handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
    initialize: vi.fn(),
  },
}));

// Mock the config for embedding fallback
vi.mock('../../config/index.js', () => ({
  config: {
    ai: {
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      model: 'test-model',
    },
  },
}));

import { ragService } from '../modules/ai/rag-service.js';

describe('RAGService - count query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use $1-based placeholders in count query when filters are provided', async () => {
    const { db } = await import('../modules/database/yugabyte-client.js');

    // Mock the main search query
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        { id: 'doc-1', content: 'test', metadata: { type: 'api' }, similarity: 0.9 },
      ],
      rowCount: 1,
      fields: [],
    });

    // Mock the count query
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ count: '5' }],
      rowCount: 1,
      fields: [],
    });

    const result = await ragService.search({
      query: 'test query',
      topK: 5,
      filters: { type: 'api' },
    });

    // Verify the count query
    const countCall = vi.mocked(db.query).mock.calls[1];
    expect(countCall).toBeDefined();
    const [countSql, countParams] = countCall;

    // The count query should use $1 (not $3 or higher)
    expect(countSql).toContain("metadata->>'type' = $1");
    expect(countParams).toEqual(['api']);

    expect(result.totalFound).toBe(5);
  });

  it('should pass empty params for count query when no filters', async () => {
    const { db } = await import('../modules/database/yugabyte-client.js');

    // Mock the main search query
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      fields: [],
    });

    // Mock the count query
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ count: '0' }],
      rowCount: 1,
      fields: [],
    });

    const result = await ragService.search({
      query: 'test query',
      topK: 5,
    });

    // Verify the count query has no params
    const countCall = vi.mocked(db.query).mock.calls[1];
    const [countSql, countParams] = countCall;

    expect(countSql).toBe('SELECT COUNT(*) as count FROM rag_documents ');
    expect(countParams).toEqual([]);

    expect(result.totalFound).toBe(0);
  });

  it('should handle multiple filters with correct parameter numbering', async () => {
    const { db } = await import('../modules/database/yugabyte-client.js');

    // Mock the main search query
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      fields: [],
    });

    // Mock the count query
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ count: '3' }],
      rowCount: 1,
      fields: [],
    });

    const result = await ragService.search({
      query: 'test',
      topK: 10,
      filters: { type: 'code-example', language: 'python' },
    });

    const countCall = vi.mocked(db.query).mock.calls[1];
    const [countSql, countParams] = countCall;

    // Should use $1 and $2 (not $3, $4)
    expect(countSql).toContain('$1');
    expect(countSql).toContain('$2');
    expect(countSql).not.toContain('$3');
    expect(countParams).toEqual(['code-example', 'python']);

    expect(result.totalFound).toBe(3);
  });
});
