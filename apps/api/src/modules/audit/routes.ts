/**
 * Audit Log Routes
 * Query and export audit logs (admin only)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { auditLog } from './audit.service.js';
import { requireRole } from '../auth/auth.plugin.js';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // Initialize audit service
  await auditLog.initialize();

  /**
   * GET /
   * Query audit logs (admin only)
   */
  fastify.get('/', {
    preHandler: [requireRole('admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = querySchema.parse(request.query);

    const result = await auditLog.query({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return result;
  });

  /**
   * GET /resource/:resource/:resourceId
   * Get audit history for a specific resource
   */
  fastify.get('/resource/:resource/:resourceId', {
    preHandler: [requireRole('admin')],
  }, async (request: FastifyRequest<{
    Params: { resource: string; resourceId: string };
    Querystring: { limit?: number };
  }>, reply: FastifyReply) => {
    const { resource, resourceId } = request.params;
    const limit = request.query.limit || 50;

    const logs = await auditLog.getResourceHistory(resource, resourceId, limit);

    return { logs };
  });

  /**
   * GET /user/:userId
   * Get audit activity for a specific user
   */
  fastify.get('/user/:userId', {
    preHandler: [requireRole('admin')],
  }, async (request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { days?: number };
  }>, reply: FastifyReply) => {
    const { userId } = request.params;
    const days = request.query.days || 30;

    const activity = await auditLog.getUserActivity(userId, days);

    return activity;
  });

  /**
   * GET /my-activity
   * Get current user's audit activity
   */
  fastify.get('/my-activity', async (request: FastifyRequest<{
    Querystring: { days?: number };
  }>, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const days = request.query.days || 30;
    const activity = await auditLog.getUserActivity(request.user.id, days);

    return activity;
  });

  /**
   * POST /cleanup
   * Cleanup old audit logs (admin only)
   */
  fastify.post('/cleanup', {
    preHandler: [requireRole('admin')],
  }, async (request: FastifyRequest<{
    Body: { retentionDays?: number };
  }>, reply: FastifyReply) => {
    const retentionDays = request.body?.retentionDays || 90;

    const deleted = await auditLog.cleanup(retentionDays);

    await auditLog.log({
      action: 'audit.cleanup',
      userId: request.user?.id,
      resource: 'audit_logs',
      details: { retentionDays, deleted },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { deleted, retentionDays };
  });
}
