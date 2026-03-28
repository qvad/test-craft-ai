/**
 * TestCraft AI API Server
 * Production-ready Fastify server with authentication, rate limiting, and observability
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fs from 'fs';

// Core modules
import { db } from './modules/database/yugabyte-client.js';
import { runMigrations } from './modules/database/migrations.js';
import { logger } from './common/logger.js';
import { errorHandlerPlugin } from './common/error-handler.js';
import { config } from './config/index.js';

// Security & Auth
import authPlugin from './modules/auth/auth.plugin.js';
import securityHeaders from './common/security-headers.js';
import rateLimitPlugin, { createRateLimitMiddleware } from './common/rate-limiter.js';

// Observability
import metricsPlugin from './modules/metrics/metrics.service.js';

// Route modules
import { executionRoutes } from './modules/execution/routes.js';
import { containersRoutes } from './modules/containers/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { hoconRoutes } from './modules/hocon/routes.js';
import { contextRoutes } from './modules/context/routes.js';
import { reportingRoutes } from './modules/reporting/routes.js';
import { websocketRoutes } from './modules/websocket/routes.js';
import { testingRoutes } from './modules/testing/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { auditRoutes } from './modules/audit/routes.js';
import { docsRoutes } from './modules/docs/openapi.js';
import { varsRoutes } from './modules/vars/routes.js';

/**
 * Create and configure the Fastify server
 */
async function createServer(): Promise<FastifyInstance> {
  // TLS configuration for HTTPS
  const tlsOptions = config.tls.enabled
    ? {
        https: {
          key: fs.readFileSync(config.tls.keyPath),
          cert: fs.readFileSync(config.tls.certPath),
          ...(config.tls.caPath ? { ca: fs.readFileSync(config.tls.caPath) } : {}),
        },
      }
    : {};

  const app = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.logging.format === 'pretty'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: config.security.trustedProxies.length > 0,
    ...tlsOptions,
  });

  return app;
}

/**
 * Register plugins and middleware
 */
async function registerPlugins(app: FastifyInstance): Promise<void> {
  // Security headers (must be early in the chain)
  await app.register(securityHeaders);

  // CORS configuration
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86400, // 24 hours
  });

  // WebSocket support
  await app.register(websocket);

  // Centralized error handling
  await app.register(errorHandlerPlugin);

  // Metrics collection (before rate limiting to capture all requests)
  await app.register(metricsPlugin);

  // Global rate limiting using YugabyteDB
  if (config.rateLimit.enabled) {
    await app.register(rateLimitPlugin, {
      max: config.rateLimit.globalMaxRequests,
      windowMs: config.rateLimit.globalWindowMs,
      message: 'Too many requests. Please try again later.',
    });
  }

  // Authentication (after rate limiting)
  await app.register(authPlugin);
}

/**
 * Register all route modules
 */
async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health routes (public, no auth)
  await app.register(healthRoutes, { prefix: '/api/v1/health' });

  // Auth routes (mostly public)
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Core API routes (require auth)
  await app.register(executionRoutes, { prefix: '/api/v1/executions' });
  await app.register(containersRoutes, { prefix: '/api/v1/containers' });
  await app.register(reportingRoutes, { prefix: '/api/v1/reports' });
  await app.register(testingRoutes, { prefix: '/api/v1' });
  await app.register(hoconRoutes, { prefix: '/api/v1' });
  await app.register(contextRoutes, { prefix: '/api/v1' });

  // Global variables service (accessed by Docker/K8s runners — cluster-internal)
  await app.register(varsRoutes, { prefix: '/api/v1/vars' });

  // AI routes with stricter rate limiting
  await app.register(async (aiApp) => {
    aiApp.addHook('onRequest', createRateLimitMiddleware({
      max: config.rateLimit.aiMaxRequests,
      windowMs: config.rateLimit.aiWindowMs,
      message: 'AI rate limit exceeded. Please wait before making more AI requests.',
      keyGenerator: (request) => `ai:${request.user?.id || request.ip}`,
    }));
    await aiApp.register(aiRoutes);
  }, { prefix: '/api/v1/ai' });

  // Audit routes (admin only)
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });

  // API Documentation (public)
  await app.register(docsRoutes, { prefix: '/api/v1/docs' });

  // WebSocket routes
  await app.register(websocketRoutes);
}

/**
 * Initialize database and run migrations
 */
async function initializeDatabase(): Promise<void> {
  try {
    await db.connect();
    logger.info('Connected to YugabyteDB');

    // Run migrations
    await runMigrations();
    logger.info('Database migrations complete');
  } catch (err) {
    logger.error({ err }, 'Database initialization failed');
    if (config.isProduction) {
      throw err; // Fail fast in production
    }
    logger.warn('Continuing without database - some features may be unavailable');
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(app: FastifyInstance): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');

    // Set a timeout for graceful shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout

    try {
      // Stop accepting new connections
      await app.close();
      logger.info('Server closed, no longer accepting connections');

      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  signals.forEach((signal) => {
    process.on(signal, () => shutdown(signal));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled promise rejection');
  });
}

/**
 * Main entry point
 */
async function start(): Promise<void> {
  try {
    logger.info({
      nodeEnv: config.nodeEnv,
      isProduction: config.isProduction,
    }, 'Starting TestCraft API server...');

    // Create server
    const app = await createServer();

    // Register plugins and routes
    await registerPlugins(app);
    await registerRoutes(app);

    // Stateful placeholder routes for integration tests
    const users = new Map<string, any>();
    app.get('/api/v1/users', async () => ({ users: Array.from(users.values()) }));
    app.post('/api/v1/users', async (req: any) => {
      const id = req.body.id || `user-${Date.now()}`;
      const user = { id, ...req.body, status: 'created' };
      users.set(id, user);
      return user;
    });
    app.get('/api/v1/users/:id', async (req: any, reply) => {
      const user = users.get(req.params.id);
      if (!user) return reply.status(404).send({ error: 'Not Found' });
      return user;
    });
    app.put('/api/v1/users/:id', async (req: any, reply) => {
      if (!users.has(req.params.id)) return reply.status(404).send({ error: 'Not Found' });
      const user = { ...users.get(req.params.id), ...req.body };
      users.set(req.params.id, user);
      return { status: 'updated', user };
    });
    app.patch('/api/v1/users/:id', async (req: any, reply) => {
      if (!users.has(req.params.id)) return reply.status(404).send({ error: 'Not Found' });
      const user = { ...users.get(req.params.id), ...req.body };
      users.set(req.params.id, user);
      return { status: 'updated', user };
    });
    app.delete('/api/v1/users/:id', async (req: any, reply) => {
      if (!users.has(req.params.id)) return reply.status(404).send({ error: 'Not Found' });
      users.delete(req.params.id);
      return { status: 'deleted' };
    });
    app.get('/api/v1/products', async () => ({ products: [] }));
    app.get('/api/v1/products/search', async () => ({ products: [] }));
    app.post('/api/v1/auth/token', async () => ({ token: 'mock-token' }));
    app.get('/api/v1/version', async () => ({ version: '1.0.0' }));

    // Initialize database
    await initializeDatabase();

    // Setup graceful shutdown
    setupGracefulShutdown(app);

    // Start listening
    const protocol = config.tls.enabled ? 'https' : 'http';
    const address = await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info({
      address,
      protocol,
      port: config.port,
      metricsPath: config.metrics.path,
    }, `TestCraft API server running at ${address}`);

    // Log startup info
    if (!config.isProduction) {
      logger.info({
        endpoints: {
          api: `${address}/api/v1`,
          health: `${address}/api/v1/health`,
          metrics: `${address}${config.metrics.path}`,
          docs: `${address}/api/v1/docs`,
        },
      }, 'Available endpoints');
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
start();
