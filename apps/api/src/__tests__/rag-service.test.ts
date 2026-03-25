/**
 * Tests for the RAG Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ragService } from '../modules/ai/rag-service.js';

// Mock the database
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
    initialize: vi.fn(),
  },
}));

describe('RAGService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('indexDocument', () => {
    it('should index a document with embedding', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'doc-1',
          content: 'Test content',
          metadata: { type: 'test' },
        }],
        rowCount: 1,
        fields: [],
      });

      const result = await ragService.indexDocument({
        id: 'doc-1',
        content: 'Test content for embedding',
        metadata: { type: 'test' },
      });

      expect(result.id).toBe('doc-1');
      expect(result.embedding).toBeDefined();
      expect(result.embedding).toHaveLength(1536);
      expect(db.query).toHaveBeenCalled();
    });

    it('should handle duplicate document upsert', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'doc-existing',
          content: 'Updated content',
          metadata: { type: 'test', updated: true },
        }],
        rowCount: 1,
        fields: [],
      });

      const result = await ragService.indexDocument({
        id: 'doc-existing',
        content: 'Updated content',
        metadata: { type: 'test', updated: true },
      });

      expect(result.id).toBe('doc-existing');
    });
  });

  describe('search', () => {
    it('should search for similar documents', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      // Mock search results
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [
            { id: 'doc-1', content: 'Similar content 1', metadata: {}, similarity: 0.95 },
            { id: 'doc-2', content: 'Similar content 2', metadata: {}, similarity: 0.85 },
          ],
          rowCount: 2,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '10' }],
          rowCount: 1,
          fields: [],
        });

      const result = await ragService.search({
        query: 'Find similar content',
        topK: 5,
      });

      expect(result.documents).toHaveLength(2);
      expect(result.documents[0].score).toBe(0.95);
      expect(result.totalFound).toBe(10);
      expect(result.queryTime).toBeGreaterThan(0);
    });

    it('should apply filters to search', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [
            { id: 'doc-1', content: 'Filtered content', metadata: { type: 'api-doc' }, similarity: 0.9 },
          ],
          rowCount: 1,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '5' }],
          rowCount: 1,
          fields: [],
        });

      const result = await ragService.search({
        query: 'API documentation',
        topK: 5,
        filters: { type: 'api-doc' },
      });

      expect(result.documents).toHaveLength(1);
      expect(db.query).toHaveBeenCalled();
    });

    it('should return empty results for no matches', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          rowCount: 1,
          fields: [],
        });

      const result = await ragService.search({
        query: 'Non-existent content',
        topK: 5,
      });

      expect(result.documents).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });
  });

  describe('indexCodeExample', () => {
    it('should index code examples with proper metadata', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'code-1',
          content: 'Language: java...',
          metadata: { type: 'code-example', language: 'java', nodeType: 'jdbc-request' },
        }],
        rowCount: 1,
        fields: [],
      });

      await ragService.indexCodeExample({
        id: 'code-1',
        language: 'java',
        nodeType: 'jdbc-request',
        description: 'Query users from database',
        code: 'SELECT * FROM users WHERE active = true',
        tags: ['sql', 'query', 'users'],
      });

      expect(db.query).toHaveBeenCalled();
      const callArgs = vi.mocked(db.query).mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO rag_documents');
    });
  });

  describe('indexAPIDoc', () => {
    it('should index API documentation', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'api-1',
          content: 'API Endpoint: POST /users...',
          metadata: { type: 'api-doc', endpoint: '/users', method: 'POST' },
        }],
        rowCount: 1,
        fields: [],
      });

      await ragService.indexAPIDoc({
        id: 'api-1',
        endpoint: '/users',
        method: 'POST',
        description: 'Create a new user',
        requestSchema: { type: 'object', properties: { email: { type: 'string' } } },
        responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('indexDatabaseSchema', () => {
    it('should index database schema', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'schema-1',
          content: 'Table: users...',
          metadata: { type: 'db-schema', tableName: 'users' },
        }],
        rowCount: 1,
        fields: [],
      });

      await ragService.indexDatabaseSchema({
        id: 'schema-1',
        tableName: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', description: 'Primary key' },
          { name: 'email', type: 'VARCHAR(255)', description: 'User email' },
          { name: 'created_at', type: 'TIMESTAMP' },
        ],
        relationships: [
          { table: 'orders', type: 'one-to-many' },
        ],
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        fields: [],
      });

      const result = await ragService.deleteDocument('doc-to-delete');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM rag_documents WHERE id = $1',
        ['doc-to-delete']
      );
    });

    it('should return false for non-existent document', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        fields: [],
      });

      const result = await ragService.deleteDocument('non-existent');

      expect(result).toBe(false);
    });
  });
});
