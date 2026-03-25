/**
 * GlobalVarsService
 *
 * Live global variable store for test executions.
 * Runners running inside Docker/K8s pods fetch variables via HTTP at startup and
 * can poll for updates throughout execution. After finishing, runners post back
 * extractedValues which become available to subsequent nodes.
 *
 * Storage: in-memory L1 cache (Map) + YugabyteDB L2 persistence.
 * Writes go to both; reads hit L1 first, fall back to L2 on miss.
 * This makes the service fast for same-pod reads while being durable and
 * accessible from any pod in the cluster.
 */

import { db } from '../database/yugabyte-client.js';
import { logger } from '../../common/logger.js';

/** Flat map of variable name → JSON-serialisable value */
export type VarsMap = Record<string, unknown>;

class GlobalVarsService {
  /** L1 cache: executionId → variable map */
  private cache = new Map<string, VarsMap>();

  // ─── Read ────────────────────────────────────────────────────────────────

  /**
   * Return all variables for an execution as a flat map.
   * Hits L1 first, then falls back to YugabyteDB.
   */
  async getAll(executionId: string): Promise<VarsMap> {
    const cached = this.cache.get(executionId);
    if (cached) return { ...cached };

    try {
      const rows = await db.query<{ var_name: string; var_value: unknown }>(
        `SELECT var_name, var_value FROM execution_vars WHERE execution_id = $1`,
        [executionId],
      );
      const vars: VarsMap = {};
      for (const row of rows.rows) vars[row.var_name] = row.var_value;
      this.cache.set(executionId, vars);
      return { ...vars };
    } catch (err) {
      logger.warn({ err, executionId }, '[vars] DB unavailable, returning empty vars');
      return {};
    }
  }

  // ─── Write ───────────────────────────────────────────────────────────────

  /**
   * Merge `vars` into the execution's variable map (upsert semantics).
   * Existing keys are overwritten; others are preserved.
   */
  async setMany(executionId: string, vars: VarsMap): Promise<void> {
    if (Object.keys(vars).length === 0) return;

    // Update L1
    const current = this.cache.get(executionId) ?? {};
    this.cache.set(executionId, { ...current, ...vars });

    // Persist to L2
    try {
      const entries = Object.entries(vars);
      // Batch upsert — one round-trip per call
      const values = entries.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
      const params: unknown[] = [executionId];
      for (const [k, v] of entries) params.push(k, JSON.stringify(v));

      await db.query(
        `INSERT INTO execution_vars (execution_id, var_name, var_value, updated_at)
         VALUES ${values}
         ON CONFLICT (execution_id, var_name)
         DO UPDATE SET var_value = EXCLUDED.var_value, updated_at = NOW()`,
        params,
      );
    } catch (err) {
      logger.warn({ err, executionId }, '[vars] DB write failed — L1 updated, L2 behind');
    }
  }

  /**
   * Delete all variables for an execution (called at plan teardown).
   */
  async clear(executionId: string): Promise<void> {
    this.cache.delete(executionId);
    try {
      await db.query(`DELETE FROM execution_vars WHERE execution_id = $1`, [executionId]);
    } catch (err) {
      logger.warn({ err, executionId }, '[vars] DB delete failed');
    }
  }

  // ─── Initialise from plan variables ──────────────────────────────────────

  /**
   * Seed an execution's variable store from a HOCON plan's `variables` block.
   * Called once when a plan starts executing.
   */
  async seed(executionId: string, planVars: VarsMap): Promise<void> {
    await this.setMany(executionId, planVars);
    logger.debug(
      { executionId, count: Object.keys(planVars).length },
      '[vars] Seeded execution variables from plan',
    );
  }
}

export const globalVarsService = new GlobalVarsService();
