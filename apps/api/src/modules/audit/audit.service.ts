/**
 * Audit Logging Service
 * Comprehensive audit trail for sensitive operations using YugabyteDB
 */

import { db } from '../database/yugabyte-client.js';
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';

export interface AuditLogEntry {
  action: string;
  userId?: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  result?: 'success' | 'failure';
  errorMessage?: string;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: string;
  timestamp: Date;
}

export interface AuditQueryOptions {
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class AuditService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create audit log table with partitioning-friendly structure
    await db.query(`
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
      )
    `);

    // Create indexes for efficient querying
    await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id)');

    // Create composite index for common query patterns
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
      ON audit_logs(user_id, timestamp DESC)
    `);

    this.initialized = true;
    logger.info('Audit logging schema initialized');
  }

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await db.query<{ id: string }>(
        `INSERT INTO audit_logs (action, user_id, resource, resource_id, details, ip_address, user_agent, result, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          entry.action,
          entry.userId || null,
          entry.resource,
          entry.resourceId || null,
          JSON.stringify(entry.details || {}),
          entry.ip || null,
          entry.userAgent?.substring(0, 500) || null,
          entry.result || 'success',
          entry.errorMessage || null,
        ]
      );

      // Also log to structured logger for real-time monitoring
      logger.info({
        audit: true,
        action: entry.action,
        userId: entry.userId,
        resource: entry.resource,
        resourceId: entry.resourceId,
        result: entry.result || 'success',
      }, `Audit: ${entry.action}`);

      return result.rows[0].id;
    } catch (error) {
      // Don't fail the request if audit logging fails, but do log the error
      logger.error({ error, entry }, 'Failed to write audit log');
      return '';
    }
  }

  /**
   * Log a successful operation
   */
  async logSuccess(entry: Omit<AuditLogEntry, 'result'>): Promise<string> {
    return this.log({ ...entry, result: 'success' });
  }

  /**
   * Log a failed operation
   */
  async logFailure(entry: Omit<AuditLogEntry, 'result'>, errorMessage: string): Promise<string> {
    return this.log({ ...entry, result: 'failure', errorMessage });
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions): Promise<{ logs: AuditLogRecord[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }

    if (options.resource) {
      conditions.push(`resource = $${paramIndex++}`);
      params.push(options.resource);
    }

    if (options.action) {
      conditions.push(`action LIKE $${paramIndex++}`);
      params.push(`${options.action}%`);
    }

    if (options.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params
    );

    // Get logs
    const logsResult = await db.query<AuditLogRecord>(
      `SELECT id, timestamp, action, user_id as "userId", resource, resource_id as "resourceId",
              details, ip_address as ip, user_agent as "userAgent", result, error_message as "errorMessage"
       FROM audit_logs
       ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceHistory(resource: string, resourceId: string, limit = 50): Promise<AuditLogRecord[]> {
    const result = await db.query<AuditLogRecord>(
      `SELECT id, timestamp, action, user_id as "userId", resource, resource_id as "resourceId",
              details, ip_address as ip, user_agent as "userAgent", result, error_message as "errorMessage"
       FROM audit_logs
       WHERE resource = $1 AND resource_id = $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [resource, resourceId, limit]
    );

    return result.rows;
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId: string, days = 30): Promise<{
    totalActions: number;
    actionCounts: Record<string, number>;
    recentActions: AuditLogRecord[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get action counts
    const countsResult = await db.query<{ action: string; count: string }>(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       WHERE user_id = $1 AND timestamp >= $2
       GROUP BY action
       ORDER BY count DESC`,
      [userId, startDate]
    );

    const actionCounts: Record<string, number> = {};
    let totalActions = 0;
    for (const row of countsResult.rows) {
      actionCounts[row.action] = parseInt(row.count, 10);
      totalActions += parseInt(row.count, 10);
    }

    // Get recent actions
    const recentResult = await db.query<AuditLogRecord>(
      `SELECT id, timestamp, action, user_id as "userId", resource, resource_id as "resourceId",
              details, result, error_message as "errorMessage"
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT 20`,
      [userId]
    );

    return {
      totalActions,
      actionCounts,
      recentActions: recentResult.rows,
    };
  }

  /**
   * Cleanup old audit logs (retention policy)
   */
  async cleanup(retentionDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.query(
      'DELETE FROM audit_logs WHERE timestamp < $1',
      [cutoffDate]
    );

    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      logger.info({ deleted, cutoffDate }, 'Cleaned up old audit logs');
    }

    return deleted;
  }
}

export const auditLog = new AuditService();

// Export convenience functions
export async function logAudit(entry: AuditLogEntry): Promise<string> {
  return auditLog.log(entry);
}
