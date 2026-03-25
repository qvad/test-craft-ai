/**
 * Database Migration System
 * Versioned migrations with rollback support for YugabyteDB
 */

import { db } from './yugabyte-client.js';
import { logger } from '../../common/logger.js';
import crypto from 'crypto';

export interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
  checksum?: string;
}

interface MigrationRecord {
  version: string;
  name: string;
  checksum: string;
  applied_at: Date;
  execution_time_ms: number;
}

class MigrationRunner {
  private readonly tableName = 'schema_migrations';

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_time_ms INTEGER,
        rolled_back_at TIMESTAMP WITH TIME ZONE
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_migrations_applied
      ON ${this.tableName}(applied_at DESC)
    `);

    logger.info('Migration system initialized');
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await db.query<MigrationRecord>(
      `SELECT version, name, checksum, applied_at, execution_time_ms
       FROM ${this.tableName}
       WHERE rolled_back_at IS NULL
       ORDER BY version ASC`
    );
    return result.rows;
  }

  /**
   * Calculate checksum for a migration
   */
  private calculateChecksum(migration: Migration): string {
    return crypto
      .createHash('sha256')
      .update(migration.up + migration.down)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Run pending migrations
   */
  async migrate(migrations: Migration[]): Promise<{ applied: string[]; skipped: string[] }> {
    await this.initialize();

    const applied: string[] = [];
    const skipped: string[] = [];
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    // Sort migrations by version
    const sortedMigrations = [...migrations].sort((a, b) =>
      a.version.localeCompare(b.version)
    );

    for (const migration of sortedMigrations) {
      if (appliedVersions.has(migration.version)) {
        // Check for checksum mismatch
        const existing = appliedMigrations.find(m => m.version === migration.version);
        const currentChecksum = this.calculateChecksum(migration);

        if (existing && existing.checksum !== currentChecksum) {
          throw new Error(
            `Migration ${migration.version} (${migration.name}) has been modified after being applied. ` +
            `Expected checksum: ${existing.checksum}, got: ${currentChecksum}`
          );
        }

        skipped.push(migration.version);
        continue;
      }

      const checksum = this.calculateChecksum(migration);
      const start = Date.now();

      logger.info({ version: migration.version, name: migration.name }, 'Applying migration');

      try {
        await db.transaction(async (client) => {
          // Run the up migration
          await client.query(migration.up);

          // Record the migration
          await client.query(
            `INSERT INTO ${this.tableName} (version, name, checksum, execution_time_ms)
             VALUES ($1, $2, $3, $4)`,
            [migration.version, migration.name, checksum, Date.now() - start]
          );
        });

        applied.push(migration.version);
        logger.info(
          { version: migration.version, name: migration.name, duration: Date.now() - start },
          'Migration applied successfully'
        );
      } catch (error) {
        logger.error(
          { error, version: migration.version, name: migration.name },
          'Migration failed'
        );
        throw error;
      }
    }

    return { applied, skipped };
  }

  /**
   * Rollback the last N migrations
   */
  async rollback(migrations: Migration[], count = 1): Promise<string[]> {
    await this.initialize();

    const rolledBack: string[] = [];
    const appliedMigrations = await this.getAppliedMigrations();

    // Get the last N applied migrations
    const toRollback = appliedMigrations.slice(-count).reverse();

    for (const record of toRollback) {
      const migration = migrations.find(m => m.version === record.version);

      if (!migration) {
        throw new Error(
          `Cannot rollback migration ${record.version}: migration definition not found`
        );
      }

      logger.info({ version: migration.version, name: migration.name }, 'Rolling back migration');

      try {
        await db.transaction(async (client) => {
          // Run the down migration
          await client.query(migration.down);

          // Mark as rolled back
          await client.query(
            `UPDATE ${this.tableName}
             SET rolled_back_at = NOW()
             WHERE version = $1`,
            [migration.version]
          );
        });

        rolledBack.push(migration.version);
        logger.info({ version: migration.version, name: migration.name }, 'Migration rolled back');
      } catch (error) {
        logger.error(
          { error, version: migration.version, name: migration.name },
          'Rollback failed'
        );
        throw error;
      }
    }

    return rolledBack;
  }

  /**
   * Get migration status
   */
  async status(migrations: Migration[]): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    await this.initialize();

    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));

    const pending = migrations
      .filter(m => !appliedVersions.has(m.version))
      .sort((a, b) => a.version.localeCompare(b.version));

    return {
      applied,
      pending,
      total: migrations.length,
    };
  }

  /**
   * Reset database (dangerous - drops all tables)
   */
  async reset(): Promise<void> {
    logger.warn('Resetting database - all data will be lost!');

    await db.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$
    `);

    logger.info('Database reset complete');
  }
}

export const migrationRunner = new MigrationRunner();

// ============================================================================
// Migration Definitions
// ============================================================================

export const migrations: Migration[] = [
  {
    version: '001',
    name: 'create_extensions',
    up: `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE EXTENSION IF NOT EXISTS vector;
    `,
    down: `
      DROP EXTENSION IF EXISTS vector;
      DROP EXTENSION IF EXISTS pgcrypto;
    `,
  },
  {
    version: '002',
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_users_email ON users(email);
    `,
    down: `
      DROP TABLE IF EXISTS users CASCADE;
    `,
  },
  {
    version: '003',
    name: 'create_api_keys_table',
    up: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scopes TEXT[] DEFAULT ARRAY['read'],
        expires_at TIMESTAMP WITH TIME ZONE,
        last_used_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
      CREATE INDEX idx_api_keys_user ON api_keys(user_id);
    `,
    down: `
      DROP TABLE IF EXISTS api_keys CASCADE;
    `,
  },
  {
    version: '004',
    name: 'create_revoked_tokens_table',
    up: `
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

      CREATE INDEX idx_revoked_tokens_expires ON revoked_tokens(expires_at);
    `,
    down: `
      DROP TABLE IF EXISTS revoked_tokens CASCADE;
    `,
  },
  {
    version: '005',
    name: 'create_user_sessions_table',
    up: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_sessions_user ON user_sessions(user_id);
    `,
    down: `
      DROP TABLE IF EXISTS user_sessions CASCADE;
    `,
  },
  {
    version: '006',
    name: 'create_audit_logs_table',
    up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        action TEXT NOT NULL,
        user_id UUID,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details JSONB DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        result TEXT DEFAULT 'success' CHECK (result IN ('success', 'failure')),
        error_message TEXT,
        session_id TEXT,
        request_id TEXT
      );

      CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
      CREATE INDEX idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
      CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, timestamp DESC);
    `,
    down: `
      DROP TABLE IF EXISTS audit_logs CASCADE;
    `,
  },
  {
    version: '007',
    name: 'create_rag_documents_table',
    up: `
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_rag_documents_metadata ON rag_documents USING GIN (metadata);
    `,
    down: `
      DROP TABLE IF EXISTS rag_documents CASCADE;
    `,
  },
  {
    version: '008',
    name: 'create_test_plans_table',
    up: `
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
      );
    `,
    down: `
      DROP TABLE IF EXISTS test_plans CASCADE;
    `,
  },
  {
    version: '009',
    name: 'create_tree_nodes_table',
    up: `
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
      );

      CREATE INDEX idx_tree_nodes_test_plan ON tree_nodes(test_plan_id);
      CREATE INDEX idx_tree_nodes_parent ON tree_nodes(parent_id);
    `,
    down: `
      DROP TABLE IF EXISTS tree_nodes CASCADE;
    `,
  },
  {
    version: '010',
    name: 'create_test_executions_table',
    up: `
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
      );

      CREATE INDEX idx_test_executions_plan ON test_executions(test_plan_id);
      CREATE INDEX idx_test_executions_status ON test_executions(status);
    `,
    down: `
      DROP TABLE IF EXISTS test_executions CASCADE;
    `,
  },
  {
    version: '011',
    name: 'create_node_executions_table',
    up: `
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
      );

      CREATE INDEX idx_node_executions_execution ON node_executions(execution_id);
    `,
    down: `
      DROP TABLE IF EXISTS node_executions CASCADE;
    `,
  },
  {
    version: '012',
    name: 'create_ai_generations_table',
    up: `
      CREATE TABLE IF NOT EXISTS ai_generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_id UUID REFERENCES tree_nodes(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        response TEXT,
        model TEXT,
        tokens_used INTEGER,
        confidence FLOAT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_ai_generations_node ON ai_generations(node_id);
    `,
    down: `
      DROP TABLE IF EXISTS ai_generations CASCADE;
    `,
  },
  {
    version: '013',
    name: 'create_rate_limits_table',
    up: `
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

      CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
    `,
    down: `
      DROP TABLE IF EXISTS rate_limits CASCADE;
    `,
  },
  {
    version: '014',
    name: 'create_metrics_table',
    up: `
      CREATE TABLE IF NOT EXISTS app_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        labels JSONB DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_metrics_name_time ON app_metrics(name, timestamp DESC);
      CREATE INDEX idx_metrics_labels ON app_metrics USING GIN (labels);

      -- Cleanup old metrics automatically (keep 7 days)
      -- Note: In production, use a scheduled job for this
    `,
    down: `
      DROP TABLE IF EXISTS app_metrics CASCADE;
    `,
  },
  {
    version: '015',
    name: 'create_test_plans_hocon_tables',
    up: `
      CREATE TABLE IF NOT EXISTS test_plans_hocon (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        hocon_content TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        tags TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_test_plans_hocon_name ON test_plans_hocon(name);
      CREATE INDEX idx_test_plans_hocon_tags ON test_plans_hocon USING GIN (tags);
      CREATE INDEX idx_test_plans_hocon_updated ON test_plans_hocon(updated_at DESC);

      CREATE TABLE IF NOT EXISTS test_plan_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id TEXT NOT NULL REFERENCES test_plans_hocon(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        hocon_content TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_test_plan_versions_plan ON test_plan_versions(plan_id);
      CREATE INDEX idx_test_plan_versions_plan_version ON test_plan_versions(plan_id, version DESC);
    `,
    down: `
      DROP TABLE IF EXISTS test_plan_versions CASCADE;
      DROP TABLE IF EXISTS test_plans_hocon CASCADE;
    `,
  },
];

// Run migrations on import if in development
export async function runMigrations(): Promise<void> {
  const status = await migrationRunner.status(migrations);

  if (status.pending.length > 0) {
    logger.info({ pending: status.pending.length }, 'Running pending migrations');
    await migrationRunner.migrate(migrations);
  } else {
    logger.info('All migrations up to date');
  }
}
