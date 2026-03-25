import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { orchestrator } from '../containers/orchestrator.js';
import { SUPPORTED_LANGUAGES } from '../containers/types.js';
import { db } from '../database/yugabyte-client.js';
import { logger } from '../../common/logger.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Basic health check
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Detailed health check including database and Kubernetes connectivity
  app.get('/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, { status: 'ok' | 'error'; message?: string; latency?: number }> = {};

    // Check database connectivity
    try {
      const dbHealth = await db.healthCheck();
      checks.database = {
        status: dbHealth.status,
        latency: dbHealth.latency,
        message: dbHealth.message,
      };
    } catch (err) {
      checks.database = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    // Check Kubernetes connectivity
    try {
      const poolStatus = await orchestrator.getPoolStatus();
      checks.kubernetes = { status: 'ok' };

      // Check each language runner
      for (const lang of SUPPORTED_LANGUAGES) {
        const status = poolStatus[lang];
        if (status && status.ready > 0) {
          checks[`runner_${lang}`] = { status: 'ok' };
        } else {
          checks[`runner_${lang}`] = {
            status: 'error',
            message: `No ready pods (${status?.ready || 0}/${status?.total || 0})`,
          };
        }
      }
    } catch (err) {
      checks.kubernetes = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    // Critical checks that affect overall status
    const criticalChecks = ['database'];
    const hasCriticalFailure = criticalChecks.some(
      (key) => checks[key]?.status === 'error'
    );

    const overallStatus = hasCriticalFailure
      ? 'unhealthy'
      : Object.values(checks).every((c) => c.status === 'ok')
        ? 'ok'
        : 'degraded';

    return reply.send({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      checks,
    });
  });

  // Readiness check (for Kubernetes)
  app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    const errors: string[] = [];

    // Check database connectivity (critical)
    try {
      const dbHealth = await db.healthCheck();
      if (dbHealth.status !== 'ok') {
        errors.push(`Database: ${dbHealth.message || 'unhealthy'}`);
      }
    } catch (err) {
      errors.push(`Database: ${err instanceof Error ? err.message : 'connection failed'}`);
    }

    // Check Kubernetes connectivity (optional - don't block startup)
    try {
      await orchestrator.getPoolStatus();
    } catch (err) {
      logger.warn({ err }, 'Kubernetes not available - continuing without runner support');
    }

    if (errors.length > 0) {
      logger.error({ errors }, 'Readiness check failed');
      return reply.status(503).send({
        status: 'not_ready',
        errors,
      });
    }

    return reply.send({ status: 'ready' });
  });

  // Liveness check (for Kubernetes)
  app.get('/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'alive' });
  });
}
