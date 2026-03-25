/**
 * Fastify Authentication Plugin
 * Handles JWT and API key authentication middleware
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { authService, User, AuthResult } from './auth.service.js';
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    scopes?: string[];
    authMethod?: 'jwt' | 'api-key' | 'none';
  }
}

export interface AuthOptions {
  /** Routes that don't require authentication */
  publicRoutes?: string[];
  /** Whether to allow unauthenticated requests (returns null user) */
  allowAnonymous?: boolean;
}

async function authPlugin(fastify: FastifyInstance, options: AuthOptions = {}): Promise<void> {
  const publicRoutes = new Set([
    '/api/v1/health',
    '/api/v1/health/live',
    '/api/v1/health/ready',
    '/api/v1/health/detailed',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/metrics',
    '/api/v1/docs',
    '/api/v1/docs/openapi.json',
    ...(options.publicRoutes || []),
  ]);

  // Initialize auth service
  await authService.initialize();

  // Add authentication hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public routes
    const path = request.url.split('?')[0];
    if (publicRoutes.has(path) || path.startsWith('/api/v1/health')) {
      request.authMethod = 'none';
      return;
    }

    // Skip auth in development if configured
    if (!config.isProduction && config.auth.skipInDevelopment) {
      request.authMethod = 'none';
      request.user = {
        id: 'dev-user',
        email: 'dev@testcraft.local',
        name: 'Development User',
        role: 'admin',
        createdAt: new Date(),
      };
      request.scopes = ['read', 'write', 'delete', 'admin'];
      return;
    }

    // Try to authenticate
    const authResult = await authenticate(request);

    if (!authResult.valid) {
      if (options.allowAnonymous) {
        request.authMethod = 'none';
        return;
      }

      return reply.status(401).send({
        error: 'Unauthorized',
        message: authResult.error || 'Authentication required',
      });
    }

    request.user = authResult.user;
    request.scopes = authResult.scopes;
  });
}

async function authenticate(request: FastifyRequest): Promise<AuthResult> {
  const authHeader = request.headers.authorization;
  const apiKey = request.headers['x-api-key'] as string | undefined;

  // Try API key first
  if (apiKey) {
    request.authMethod = 'api-key';
    return authService.verifyApiKey(apiKey);
  }

  // Try Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    request.authMethod = 'jwt';
    const token = authHeader.substring(7);
    return authService.verifyJwt(token);
  }

  return { valid: false, error: 'No authentication provided' };
}

// Decorator for checking scopes
export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.scopes?.includes(scope) && !request.scopes?.includes('admin')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required scope: ${scope}`,
      });
    }
  };
}

// Decorator for requiring specific roles
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }
  };
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '4.x',
});
