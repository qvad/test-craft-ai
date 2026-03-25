/**
 * YugabyteDB-backed Rate Limiter
 * Distributed rate limiting using database for cluster deployments
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../modules/database/yugabyte-client.js';
import { logger } from './logger.js';
import { config } from '../config/index.js';

export interface RateLimitOptions {
  /** Maximum requests allowed in the time window */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function */
  keyGenerator?: (request: FastifyRequest) => string;
  /** Skip function - return true to skip rate limiting */
  skip?: (request: FastifyRequest) => boolean;
  /** Error message */
  message?: string;
}

interface RateLimitRecord {
  key: string;
  count: number;
  window_start: Date;
  expires_at: Date;
}

class YugabyteRateLimiter {
  private initialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create rate limits table (also in migrations, but ensure it exists)
    await db.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at)');

    // Start cleanup job
    this.startCleanupJob();

    this.initialized = true;
    logger.info('YugabyteDB rate limiter initialized');
  }

  /**
   * Check and increment rate limit
   * Returns { allowed: boolean, remaining: number, resetAt: Date }
   */
  async checkLimit(
    key: string,
    max: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date; total: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    const expiresAt = new Date(now.getTime() + windowMs);

    // Use upsert with conditional increment
    const result = await db.query<RateLimitRecord>(`
      INSERT INTO rate_limits (key, count, window_start, expires_at)
      VALUES ($1, 1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < $2 THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < $2 THEN $2
          ELSE rate_limits.window_start
        END,
        expires_at = $3
      RETURNING key, count, window_start, expires_at
    `, [key, windowStart, expiresAt]);

    const record = result.rows[0];
    const remaining = Math.max(0, max - record.count);
    const allowed = record.count <= max;

    return {
      allowed,
      remaining,
      resetAt: record.expires_at,
      total: record.count,
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await db.query('DELETE FROM rate_limits WHERE key = $1', [key]);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(key: string, max: number): Promise<{ count: number; remaining: number; resetAt: Date | null }> {
    const result = await db.query<RateLimitRecord>(
      'SELECT count, window_start, expires_at FROM rate_limits WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return { count: 0, remaining: max, resetAt: null };
    }

    const record = result.rows[0];
    return {
      count: record.count,
      remaining: Math.max(0, max - record.count),
      resetAt: record.expires_at,
    };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const result = await db.query('DELETE FROM rate_limits WHERE expires_at < NOW()');
    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      logger.debug({ deleted }, 'Cleaned up expired rate limit entries');
    }
    return deleted;
  }

  private startCleanupJob(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => {
        logger.error({ err }, 'Rate limit cleanup failed');
      });
    }, 5 * 60 * 1000);

    // Don't block process exit
    this.cleanupInterval.unref();
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const rateLimiter = new YugabyteRateLimiter();

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(request: FastifyRequest): string {
  // request.ip already respects trustProxy config set in main.ts
  return `ratelimit:${request.ip}`;
}

/**
 * Create rate limit middleware for specific routes
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const {
    max,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    skip,
    message = 'Too many requests, please try again later',
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip if rate limiting is disabled
    if (!config.rateLimit.enabled) return;

    // Skip if skip function returns true
    if (skip && skip(request)) return;

    const key = keyGenerator(request);
    const result = await rateLimiter.checkLimit(key, max, windowMs);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter);

      return reply.status(429).send({
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    }
  };
}

/**
 * Fastify plugin for global rate limiting
 */
async function rateLimitPlugin(
  fastify: FastifyInstance,
  options: RateLimitOptions
): Promise<void> {
  await rateLimiter.initialize();

  const middleware = createRateLimitMiddleware(options);

  fastify.addHook('onRequest', middleware);
}

export default fp(rateLimitPlugin, {
  name: 'yugabyte-rate-limit',
  fastify: '4.x',
});
