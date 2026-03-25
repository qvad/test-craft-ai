/**
 * Authentication Routes
 * Login, register, token management, API key management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { requireScope, requireRole } from './auth.plugin.js';
import { logger } from '../../common/logger.js';
import { auditLog } from '../audit/audit.service.js';
import { db } from '../database/yugabyte-client.js';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================================================
  // Public Routes
  // ============================================================================

  /**
   * POST /login
   * Authenticate user and return JWT tokens
   */
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);

    const result = await authService.authenticateUser(body.email, body.password);

    if (!result.valid || !result.user) {
      await auditLog.log({
        action: 'auth.login_failed',
        resource: 'auth',
        details: { email: body.email },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const tokens = authService.generateJwt(result.user);

    await auditLog.log({
      action: 'auth.login_success',
      userId: result.user.id,
      resource: 'auth',
      details: { email: result.user.email },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      ...tokens,
    };
  });

  /**
   * POST /register
   * Create a new user account
   */
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(request.body);

    try {
      const user = await authService.createUser(body.email, body.name, body.password);
      const tokens = authService.generateJwt(user);

      await auditLog.log({
        action: 'auth.register',
        userId: user.id,
        resource: 'users',
        resourceId: user.id,
        details: { email: user.email },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already registered',
        });
      }
      throw error;
    }
  });

  /**
   * POST /refresh
   * Refresh access token using refresh token
   */
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshTokenSchema.parse(request.body);

    // In a full implementation, validate refresh token from database
    // For now, require re-authentication
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'Token refresh not yet implemented. Please login again.',
    });
  });

  // ============================================================================
  // Protected Routes
  // ============================================================================

  /**
   * POST /logout
   * Revoke current token
   */
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    // Extract JTI from token and revoke it
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          await authService.revokeToken(payload.jti, request.user.id, new Date(payload.exp * 1000));
        } catch {
          // Ignore parse errors
        }
      }
    }

    await auditLog.log({
      action: 'auth.logout',
      userId: request.user.id,
      resource: 'auth',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  /**
   * GET /me
   * Get current user info
   */
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return {
      id: request.user.id,
      email: request.user.email,
      name: request.user.name,
      role: request.user.role,
      scopes: request.scopes,
      authMethod: request.authMethod,
    };
  });

  // ============================================================================
  // API Key Management
  // ============================================================================

  /**
   * GET /api-keys
   * List user's API keys
   */
  fastify.get('/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const result = await db.query(
      `SELECT id, name, key_prefix, scopes, expires_at, last_used_at, created_at
       FROM api_keys
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [request.user.id]
    );

    return {
      apiKeys: result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix + '...',
        scopes: row.scopes,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
      })),
    };
  });

  /**
   * POST /api-keys
   * Create a new API key
   */
  fastify.post('/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const body = createApiKeySchema.parse(request.body);
    const scopes = body.scopes || ['read', 'write'];
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const { key, id } = await authService.generateApiKey(
      request.user.id,
      body.name,
      scopes,
      expiresAt
    );

    await auditLog.log({
      action: 'api_key.create',
      userId: request.user.id,
      resource: 'api_keys',
      resourceId: id,
      details: { name: body.name, scopes },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      id,
      name: body.name,
      key, // Only shown once!
      scopes,
      expiresAt,
      warning: 'Save this key now. It will not be shown again.',
    });
  });

  /**
   * DELETE /api-keys/:id
   * Revoke an API key
   */
  fastify.delete('/api-keys/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { id } = request.params;
    const revoked = await authService.revokeApiKey(id, request.user.id);

    if (!revoked) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'API key not found',
      });
    }

    await auditLog.log({
      action: 'api_key.revoke',
      userId: request.user.id,
      resource: 'api_keys',
      resourceId: id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  // ============================================================================
  // Admin Routes
  // ============================================================================

  /**
   * GET /users (admin only)
   * List all users
   */
  fastify.get('/users', {
    preHandler: [requireRole('admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await db.query(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    return { users: result.rows };
  });
}
