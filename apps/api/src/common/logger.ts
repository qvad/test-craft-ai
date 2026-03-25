import pino from 'pino';

/**
 * Sensitive data patterns to mask in logs
 */
const MASK_PATTERNS: [RegExp, string][] = [
  [/password["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi, 'password=***MASKED***'],
  [/api[_-]?key["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi, 'api_key=***MASKED***'],
  [/token["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi, 'token=***MASKED***'],
  [/secret["']?\s*[=:]\s*["']?([^"'\s,}]+)/gi, 'secret=***MASKED***'],
  [/bearer\s+([^\s"']+)/gi, 'Bearer ***MASKED***'],
  [/:\/\/([^:]+):([^@]+)@/gi, '://$1:***MASKED***@'],
  [/AKIA[A-Z0-9]{16}/g, '***AWS_KEY_MASKED***'],
];

/**
 * Mask sensitive data in log messages
 */
function maskSensitiveData(obj: unknown): unknown {
  if (typeof obj === 'string') {
    let masked = obj;
    for (const [pattern, replacement] of MASK_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  if (obj && typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Mask known sensitive field names
      if (/password|secret|token|apikey|api_key|authorization/i.test(key)) {
        masked[key] = '***MASKED***';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  return obj;
}

/**
 * Custom log formatter with sensitive data masking
 */
const formatters = {
  log(obj: Record<string, unknown>) {
    return maskSensitiveData(obj) as Record<string, unknown>;
  },
};

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters,
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined,
});

export type Logger = typeof logger;

/**
 * Create a child logger with context
 */
export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}
