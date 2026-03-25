/**
 * Global Variables API Routes
 *
 * Lightweight endpoints consumed by Docker/K8s runner containers to read and
 * write global execution variables.  Deliberately simple — no auth token
 * required because the routes are only reachable inside the cluster (runners
 * access the API via the Kubernetes service ClusterIP / Docker bridge network).
 *
 * GET  /api/v1/vars/:executionId          → flat JSON map (used by runners on startup)
 * POST /api/v1/vars/:executionId          → merge variables (used by runners on completion)
 * DELETE /api/v1/vars/:executionId        → clear (called at plan teardown)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { globalVarsService } from './vars-service.js';
import { logger } from '../../common/logger.js';

const MergeBodySchema = z.record(z.unknown());

export async function varsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/vars/:executionId
   * Return all variables for the execution as a flat JSON object.
   * Called by runner.sh at container startup to initialise `tc_vars`.
   */
  app.get<{ Params: { executionId: string } }>(
    '/:executionId',
    async (request: FastifyRequest<{ Params: { executionId: string } }>, reply: FastifyReply) => {
      const { executionId } = request.params;
      const vars = await globalVarsService.getAll(executionId);
      logger.debug(
        { executionId, count: Object.keys(vars).length },
        '[vars] GET variables for runner',
      );
      return reply.send(vars);
    },
  );

  /**
   * POST /api/v1/vars/:executionId
   * Merge a set of variables into the execution's global state.
   * Body: { key: value, ... }
   * Called by runner.sh after execution to publish extractedValues.
   */
  app.post<{ Params: { executionId: string }; Body: Record<string, unknown> }>(
    '/:executionId',
    async (
      request: FastifyRequest<{ Params: { executionId: string }; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const { executionId } = request.params;
      const body = MergeBodySchema.parse(request.body);

      await globalVarsService.setMany(executionId, body);
      logger.debug(
        { executionId, count: Object.keys(body).length },
        '[vars] POST variables from runner',
      );
      return reply.send({ ok: true, count: Object.keys(body).length });
    },
  );

  /**
   * DELETE /api/v1/vars/:executionId
   * Remove all variables for the execution (plan teardown).
   */
  app.delete<{ Params: { executionId: string } }>(
    '/:executionId',
    async (request: FastifyRequest<{ Params: { executionId: string } }>, reply: FastifyReply) => {
      const { executionId } = request.params;
      await globalVarsService.clear(executionId);
      logger.debug({ executionId }, '[vars] Cleared variables for execution');
      return reply.send({ ok: true });
    },
  );
}
