/**
 * RAG (Retrieval Augmented Generation) Service
 * Uses YugabyteDB with pgvector extension for vector similarity search
 */

import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';
import { db } from '../database/yugabyte-client.js';
import type { RAGDocument, RAGQuery, RAGResult, EmbeddingRequest } from './types.js';

export class RAGService {
  private embeddingDimension = 1536;  // OpenAI ada-002 / text-embedding-3-small dimension

  /**
   * Index a document for RAG
   */
  async indexDocument(document: Omit<RAGDocument, 'embedding'>): Promise<RAGDocument> {
    logger.info({ docId: document.id }, 'Indexing document for RAG');

    // Generate embedding
    const embedding = await this.generateEmbedding(document.content);

    // Store in YugabyteDB
    const result = await db.query<RAGDocument>(
      `INSERT INTO rag_documents (id, content, metadata, embedding)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding,
         updated_at = NOW()
       RETURNING id, content, metadata`,
      [document.id, document.content, JSON.stringify(document.metadata), `[${embedding.join(',')}]`]
    );

    return {
      ...result.rows[0],
      embedding,
    };
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(documents: Array<Omit<RAGDocument, 'embedding'>>): Promise<number> {
    logger.info({ count: documents.length }, 'Batch indexing documents for RAG');

    let indexed = 0;
    const batchSize = 100;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      // Generate embeddings in batch
      const embeddings = await this.generateEmbeddings(batch.map(d => d.content));

      // Bulk insert with parameterized doc IDs to prevent SQL injection
      const values = batch.map((doc, idx) => {
        const embedding = embeddings[idx];
        const paramBase = idx * 3;
        return `($${paramBase + 1}, $${paramBase + 2}, $${paramBase + 3}, '[${embedding.join(',')}]')`;
      }).join(',');

      const params = batch.flatMap(doc => [doc.id, doc.content, JSON.stringify(doc.metadata)]);

      await db.query(
        `INSERT INTO rag_documents (id, content, metadata, embedding)
         VALUES ${values}
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
        params
      );

      indexed += batch.length;
    }

    return indexed;
  }

  /**
   * Search for similar documents
   */
  async search(query: RAGQuery): Promise<RAGResult> {
    const startTime = Date.now();
    logger.info({ query: query.query.substring(0, 100) }, 'Searching RAG documents');

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query.query);

    // Build filter conditions
    let filterConditions = '';
    const params: unknown[] = [`[${queryEmbedding.join(',')}]`, query.topK || 5];

    if (query.filters) {
      const allowedKeyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const filterClauses = Object.entries(query.filters).map(([key, value], idx) => {
        if (!allowedKeyPattern.test(key)) {
          throw new Error(`Invalid metadata filter key: ${key}`);
        }
        params.push(value);
        return `metadata->>'${key}' = $${params.length}`;
      });
      if (filterClauses.length > 0) {
        filterConditions = `WHERE ${filterClauses.join(' AND ')}`;
      }
    }

    // Perform vector similarity search using pgvector
    const result = await db.query<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }>(
      `SELECT
         id,
         content,
         metadata,
         1 - (embedding <=> $1::vector) as similarity
       FROM rag_documents
       ${filterConditions}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      params
    );

    const queryTime = Date.now() - startTime;

    const documents: RAGDocument[] = result.rows.map(row => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      score: row.similarity,
    }));

    // Get total count — build separate params since the count query
    // doesn't use the embedding ($1) or topK ($2) parameters
    let countFilterConditions = '';
    const countParams: unknown[] = [];

    if (query.filters) {
      const allowedKeyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const countFilterClauses = Object.entries(query.filters).map(([key, value]) => {
        if (!allowedKeyPattern.test(key)) {
          throw new Error(`Invalid metadata filter key: ${key}`);
        }
        countParams.push(value);
        return `metadata->>'${key}' = $${countParams.length}`;
      });
      if (countFilterClauses.length > 0) {
        countFilterConditions = `WHERE ${countFilterClauses.join(' AND ')}`;
      }
    }

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM rag_documents ${countFilterConditions}`,
      countParams
    );

    return {
      documents,
      totalFound: parseInt(countResult.rows[0]?.count || '0'),
      queryTime,
    };
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM rag_documents WHERE id = $1',
      [documentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Export all RAG documents to a portable JSON format
   * Useful for backup, migration, or sharing knowledge bases
   */
  async exportDocuments(options?: {
    filters?: Record<string, string>;
    includeEmbeddings?: boolean;
  }): Promise<{
    version: string;
    exportedAt: string;
    documentCount: number;
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding?: number[];
    }>;
  }> {
    logger.info({ options }, 'Exporting RAG documents');

    let filterConditions = '';
    const params: unknown[] = [];

    if (options?.filters) {
      const allowedKeyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const filterClauses = Object.entries(options.filters).map(([key, value], idx) => {
        if (!allowedKeyPattern.test(key)) {
          throw new Error(`Invalid metadata filter key: ${key}`);
        }
        params.push(value);
        return `metadata->>'${key}' = $${params.length}`;
      });
      if (filterClauses.length > 0) {
        filterConditions = `WHERE ${filterClauses.join(' AND ')}`;
      }
    }

    const selectEmbedding = options?.includeEmbeddings ? ', embedding::text as embedding_text' : '';

    const result = await db.query<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding_text?: string;
    }>(
      `SELECT id, content, metadata ${selectEmbedding}
       FROM rag_documents
       ${filterConditions}
       ORDER BY id`,
      params
    );

    const documents = result.rows.map(row => {
      const doc: {
        id: string;
        content: string;
        metadata: Record<string, unknown>;
        embedding?: number[];
      } = {
        id: row.id,
        content: row.content,
        metadata: row.metadata,
      };

      if (options?.includeEmbeddings && row.embedding_text) {
        // Parse the embedding from text format [0.1,0.2,...] to number array
        const embeddingStr = row.embedding_text.replace(/[\[\]]/g, '');
        doc.embedding = embeddingStr.split(',').map(Number);
      }

      return doc;
    });

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      documentCount: documents.length,
      documents,
    };
  }

  /**
   * Import RAG documents from an exported JSON format
   * Useful for restore, migration, or loading pre-built knowledge bases
   */
  async importDocuments(data: {
    version: string;
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding?: number[];
    }>;
  }, options?: {
    overwrite?: boolean;
    regenerateEmbeddings?: boolean;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    logger.info({ count: data.documents.length, version: data.version }, 'Importing RAG documents');

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of data.documents) {
      try {
        // Check if document exists
        const existing = await this.getDocument(doc.id);

        if (existing && !options?.overwrite) {
          skipped++;
          continue;
        }

        // Use provided embedding or regenerate
        let embedding: number[];
        if (doc.embedding && !options?.regenerateEmbeddings) {
          embedding = doc.embedding;
        } else {
          embedding = await this.generateEmbedding(doc.content);
        }

        // Insert or update
        await db.query(
          `INSERT INTO rag_documents (id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding,
             updated_at = NOW()`,
          [doc.id, doc.content, JSON.stringify(doc.metadata), `[${embedding.join(',')}]`]
        );

        imported++;
      } catch (err) {
        errors.push(`Failed to import document ${doc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Get statistics about the RAG index
   */
  async getStats(): Promise<{
    totalDocuments: number;
    documentsByType: Record<string, number>;
    indexSize: string;
  }> {
    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM rag_documents'
    );

    const typeResult = await db.query<{ type: string; count: string }>(
      `SELECT metadata->>'type' as type, COUNT(*) as count
       FROM rag_documents
       GROUP BY metadata->>'type'`
    );

    const sizeResult = await db.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size('rag_documents')) as size`
    );

    const documentsByType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      documentsByType[row.type || 'unknown'] = parseInt(row.count);
    }

    return {
      totalDocuments: parseInt(countResult.rows[0]?.count || '0'),
      documentsByType,
      indexSize: sizeResult.rows[0]?.size || 'unknown',
    };
  }

  /**
   * Clear all documents from the index
   */
  async clearAll(): Promise<number> {
    const result = await db.query('DELETE FROM rag_documents');
    return result.rowCount ?? 0;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<RAGDocument | null> {
    const result = await db.query<RAGDocument>(
      'SELECT id, content, metadata FROM rag_documents WHERE id = $1',
      [documentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Index code examples for better code generation
   */
  async indexCodeExample(example: {
    id: string;
    language: string;
    nodeType: string;
    description: string;
    code: string;
    tags?: string[];
  }): Promise<void> {
    const content = `
Language: ${example.language}
Node Type: ${example.nodeType}
Description: ${example.description}

Code:
${example.code}
`.trim();

    await this.indexDocument({
      id: example.id,
      content,
      metadata: {
        type: 'code-example',
        language: example.language,
        nodeType: example.nodeType,
        tags: example.tags || [],
      },
    });
  }

  /**
   * Index API documentation for better API test generation
   */
  async indexAPIDoc(doc: {
    id: string;
    endpoint: string;
    method: string;
    description: string;
    requestSchema?: unknown;
    responseSchema?: unknown;
    examples?: unknown[];
  }): Promise<void> {
    const content = `
API Endpoint: ${doc.method} ${doc.endpoint}
Description: ${doc.description}

Request Schema:
${JSON.stringify(doc.requestSchema, null, 2)}

Response Schema:
${JSON.stringify(doc.responseSchema, null, 2)}

Examples:
${JSON.stringify(doc.examples, null, 2)}
`.trim();

    await this.indexDocument({
      id: doc.id,
      content,
      metadata: {
        type: 'api-doc',
        endpoint: doc.endpoint,
        method: doc.method,
      },
    });
  }

  /**
   * Index database schema for better query generation
   */
  async indexDatabaseSchema(schema: {
    id: string;
    tableName: string;
    columns: Array<{ name: string; type: string; description?: string }>;
    relationships?: Array<{ table: string; type: string }>;
  }): Promise<void> {
    const content = `
Table: ${schema.tableName}

Columns:
${schema.columns.map(c => `- ${c.name} (${c.type})${c.description ? `: ${c.description}` : ''}`).join('\n')}

${schema.relationships ? `Relationships:\n${schema.relationships.map(r => `- ${r.type} with ${r.table}`).join('\n')}` : ''}
`.trim();

    await this.indexDocument({
      id: schema.id,
      content,
      metadata: {
        type: 'db-schema',
        tableName: schema.tableName,
      },
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    if (config.ai.apiKey) {
      try {
        const embeddings = await this.callEmbeddingApi([text]);
        return embeddings[0];
      } catch (err) {
        logger.warn({ err }, 'Embedding API call failed, falling back to pseudo-embedding');
      }
    }
    return this.generatePseudoEmbedding(text);
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (config.ai.apiKey) {
      try {
        return await this.callEmbeddingApi(texts);
      } catch (err) {
        logger.warn({ err }, 'Embedding API batch call failed, falling back to pseudo-embeddings');
      }
    }
    return texts.map(text => this.generatePseudoEmbedding(text));
  }

  private async callEmbeddingApi(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${config.ai.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data.map(d => d.embedding);
  }

  private generatePseudoEmbedding(text: string): number[] {
    // Simple deterministic pseudo-embedding based on text hash
    // Replace with actual embedding API in production
    const embedding: number[] = [];
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }

    const random = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.embeddingDimension; i++) {
      embedding.push(random(hash + i) * 2 - 1);
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
}

export const ragService = new RAGService();
