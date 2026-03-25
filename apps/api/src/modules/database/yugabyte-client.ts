/**
 * YugabyteDB Client with Vector Support
 * Uses pgvector extension for RAG embeddings
 */

import pg from 'pg';
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';

const { Pool } = pg;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
  fields: pg.FieldDef[];
}

class YugabyteClient {
  private pool: pg.Pool | null = null;
  private initialized = false;

  async connect(): Promise<void> {
    if (this.pool) return;

    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
      max: config.database.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle database client');
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      logger.info('Connected to YugabyteDB');
    } finally {
      client.release();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.connect();

    // Enable required extensions
    await this.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');  // For gen_random_uuid()
    await this.query('CREATE EXTENSION IF NOT EXISTS vector');    // For RAG embeddings

    // Create RAG documents table with vector column
    await this.query(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index for metadata search (YugabyteDB doesn't support ivfflat)
    // Vector similarity search works without special index, just slower for large datasets
    await this.query(`
      CREATE INDEX IF NOT EXISTS rag_documents_metadata_idx
      ON rag_documents USING GIN (metadata)
    `);

    // Create test plans table
    await this.query(`
      CREATE TABLE IF NOT EXISTS test_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        root_node_id UUID,
        variables JSONB DEFAULT '[]',
        environments JSONB DEFAULT '[]',
        status TEXT DEFAULT 'draft',
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create tree nodes table
    await this.query(`
      CREATE TABLE IF NOT EXISTS tree_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_plan_id UUID REFERENCES test_plans(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES tree_nodes(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        enabled BOOLEAN DEFAULT true,
        config JSONB NOT NULL,
        generated_code JSONB,
        validation_status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create executions table
    await this.query(`
      CREATE TABLE IF NOT EXISTS test_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_plan_id UUID REFERENCES test_plans(id),
        environment_id TEXT,
        status TEXT DEFAULT 'queued',
        triggered_by TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        results JSONB DEFAULT '[]',
        logs JSONB DEFAULT '[]',
        metrics JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create node executions table
    await this.query(`
      CREATE TABLE IF NOT EXISTS node_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID REFERENCES test_executions(id) ON DELETE CASCADE,
        node_id UUID REFERENCES tree_nodes(id),
        status TEXT DEFAULT 'pending',
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        duration_ms INTEGER,
        output JSONB,
        error JSONB,
        logs JSONB DEFAULT '[]',
        metrics JSONB DEFAULT '{}'
      )
    `);

    // Create AI generations table for audit
    await this.query(`
      CREATE TABLE IF NOT EXISTS ai_generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_id UUID REFERENCES tree_nodes(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        response TEXT,
        model TEXT,
        tokens_used INTEGER,
        confidence FLOAT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.query('CREATE INDEX IF NOT EXISTS idx_tree_nodes_test_plan ON tree_nodes(test_plan_id)');
    await this.query('CREATE INDEX IF NOT EXISTS idx_tree_nodes_parent ON tree_nodes(parent_id)');
    await this.query('CREATE INDEX IF NOT EXISTS idx_test_executions_plan ON test_executions(test_plan_id)');
    await this.query('CREATE INDEX IF NOT EXISTS idx_node_executions_execution ON node_executions(execution_id)');
    await this.query('CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata ON rag_documents USING GIN(metadata)');

    this.initialized = true;
    logger.info('YugabyteDB schema initialized');
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      await this.connect();
    }

    const start = Date.now();
    try {
      const result = await this.pool!.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn({ query: text.substring(0, 100), duration }, 'Slow query detected');
      }

      return {
        rows: result.rows as T[],
        rowCount: result.rowCount,
        fields: result.fields,
      };
    } catch (error) {
      logger.error({ error, query: text.substring(0, 100) }, 'Query error');
      throw error;
    }
  }

  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      await this.connect();
    }

    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      logger.info('Disconnected from YugabyteDB');
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number; message?: string }> {
    const start = Date.now();
    try {
      await this.query('SELECT 1');
      return {
        status: 'ok',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'error',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const db = new YugabyteClient();
