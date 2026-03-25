import { config as dotenvConfig } from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenvConfig();

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get required environment variable or throw in production
 */
function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? '';
}

/**
 * Get optional environment variable with fallback
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Generate a secure random secret for development
 */
function generateDevSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Parse CORS origins from comma-separated string
 */
function parseCorsOrigins(value: string): string | string[] | boolean {
  if (value === '*') return true; // Allow all (development only)
  if (value === 'false') return false; // Disable CORS
  if (value.includes(',')) {
    return value.split(',').map(s => s.trim());
  }
  return value;
}

export const config = {
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  corsOrigin: optionalEnv('CORS_ORIGIN', isProduction ? '' : '*'),
  corsOrigins: parseCorsOrigins(optionalEnv('CORS_ORIGIN', isProduction ? '' : '*')),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction,

  // Server TLS config
  tls: {
    enabled: process.env.TLS_ENABLED === 'true',
    certPath: process.env.TLS_CERT_PATH || '/etc/ssl/certs/server.crt',
    keyPath: process.env.TLS_KEY_PATH || '/etc/ssl/private/server.key',
    caPath: process.env.TLS_CA_PATH || undefined,
  },

  // Authentication config
  auth: {
    jwtSecret: requireEnv('JWT_SECRET', isProduction ? undefined : generateDevSecret()),
    jwtExpirySeconds: parseInt(optionalEnv('JWT_EXPIRY_SECONDS', '3600'), 10), // 1 hour
    refreshTokenExpiryDays: parseInt(optionalEnv('REFRESH_TOKEN_EXPIRY_DAYS', '30'), 10),
    skipInDevelopment: process.env.AUTH_SKIP_IN_DEV === 'true',
    apiKeyPrefix: optionalEnv('API_KEY_PREFIX', 'tc_'),
    passwordMinLength: parseInt(optionalEnv('PASSWORD_MIN_LENGTH', '8'), 10),
    maxLoginAttempts: parseInt(optionalEnv('MAX_LOGIN_ATTEMPTS', '5'), 10),
    lockoutDurationMinutes: parseInt(optionalEnv('LOCKOUT_DURATION_MINUTES', '15'), 10),
  },

  // YugabyteDB config (PostgreSQL compatible with vector support)
  database: {
    host: optionalEnv('DB_HOST', optionalEnv('YUGABYTE_HOST', 'localhost')),
    port: parseInt(optionalEnv('DB_PORT', optionalEnv('YUGABYTE_PORT', '5433')), 10),
    name: optionalEnv('DB_NAME', optionalEnv('YUGABYTE_DB', 'testcraft')),
    user: requireEnv('DB_USER', isProduction ? undefined : 'yugabyte'),
    password: requireEnv('DB_PASSWORD', isProduction ? undefined : 'yugabyte'),
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(optionalEnv('DB_POOL_SIZE', '10'), 10),
    connectionTimeoutMs: parseInt(optionalEnv('DB_CONNECTION_TIMEOUT_MS', '10000'), 10),
    idleTimeoutMs: parseInt(optionalEnv('DB_IDLE_TIMEOUT_MS', '30000'), 10),
  },

  // Kubernetes config
  k8s: {
    namespace: optionalEnv('K8S_NAMESPACE', 'testcraft-runners'),
    inCluster: process.env.K8S_IN_CLUSTER === 'true',
    configPath: process.env.KUBECONFIG || undefined,
  },

  // AI config
  ai: {
    apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    baseUrl: optionalEnv('AI_BASE_URL', 'https://api.anthropic.com/v1'),
    model: optionalEnv('AI_MODEL', 'claude-sonnet-4-20250514'),
    embeddingModel: optionalEnv('EMBEDDING_MODEL', 'text-embedding-3-small'),
  },

  // Execution config
  execution: {
    defaultTimeout: parseInt(optionalEnv('DEFAULT_TIMEOUT', '60'), 10),
    maxTimeout: parseInt(optionalEnv('MAX_TIMEOUT', '300'), 10),
    maxConcurrent: parseInt(optionalEnv('MAX_CONCURRENT', '10'), 10),
  },

  // Rate limiting config (uses YugabyteDB for distributed limiting)
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    aiMaxRequests: parseInt(optionalEnv('AI_RATE_LIMIT_MAX', '100'), 10),
    aiWindowMs: parseInt(optionalEnv('AI_RATE_LIMIT_WINDOW_MS', '60000'), 10),
    globalMaxRequests: parseInt(optionalEnv('GLOBAL_RATE_LIMIT_MAX', '1000'), 10),
    globalWindowMs: parseInt(optionalEnv('GLOBAL_RATE_LIMIT_WINDOW_MS', '60000'), 10),
    authMaxRequests: parseInt(optionalEnv('AUTH_RATE_LIMIT_MAX', '10'), 10),
    authWindowMs: parseInt(optionalEnv('AUTH_RATE_LIMIT_WINDOW_MS', '60000'), 10),
  },

  // Security headers config
  security: {
    helmet: {
      contentSecurityPolicy: process.env.CSP_ENABLED !== 'false',
      hsts: {
        maxAge: parseInt(optionalEnv('HSTS_MAX_AGE', '31536000'), 10), // 1 year
        includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
        preload: process.env.HSTS_PRELOAD === 'true',
      },
    },
    trustedProxies: optionalEnv('TRUSTED_PROXIES', '').split(',').filter(Boolean),
  },

  // Metrics config
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    path: optionalEnv('METRICS_PATH', '/metrics'),
    collectDefaultMetrics: process.env.COLLECT_DEFAULT_METRICS !== 'false',
  },

  // Logging config
  logging: {
    level: optionalEnv('LOG_LEVEL', isProduction ? 'info' : 'debug'),
    format: optionalEnv('LOG_FORMAT', isProduction ? 'json' : 'pretty'),
  },

  // Audit log config
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    retentionDays: parseInt(optionalEnv('AUDIT_RETENTION_DAYS', '90'), 10),
  },

  // Runner images
  runners: {
    java: optionalEnv('RUNNER_IMAGE_JAVA', 'testcraft/runner-java:latest'),
    python: optionalEnv('RUNNER_IMAGE_PYTHON', 'testcraft/runner-python:latest'),
    csharp: optionalEnv('RUNNER_IMAGE_CSHARP', 'testcraft/runner-csharp:latest'),
    javascript: optionalEnv('RUNNER_IMAGE_JAVASCRIPT', 'testcraft/runner-javascript:latest'),
    typescript: optionalEnv('RUNNER_IMAGE_TYPESCRIPT', 'testcraft/runner-typescript:latest'),
    go: optionalEnv('RUNNER_IMAGE_GO', 'testcraft/runner-go:latest'),
    rust: optionalEnv('RUNNER_IMAGE_RUST', 'testcraft/runner-rust:latest'),
    ruby: optionalEnv('RUNNER_IMAGE_RUBY', 'testcraft/runner-ruby:latest'),
    php: optionalEnv('RUNNER_IMAGE_PHP', 'testcraft/runner-php:latest'),
    kotlin: optionalEnv('RUNNER_IMAGE_KOTLIN', 'testcraft/runner-kotlin:latest'),
  } as Record<string, string>,
};

export type Config = typeof config;
