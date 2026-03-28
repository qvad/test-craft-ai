import { pino } from 'pino';

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
function maskSensitiveData(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // If already masked, don't process again to avoid infinite recursion
    if (obj.includes('***MASKED***')) return obj;
    
    let masked = obj;
    for (const [pattern, replacement] of MASK_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  if (Array.isArray(obj)) {
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    return obj.map(item => maskSensitiveData(item, seen));
  }

  if (typeof obj === 'object') {
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Mask known sensitive field names
      if (/password|secret|token|apikey|api_key|authorization/i.test(key)) {
        masked[key] = '***MASKED***';
      } else {
        masked[key] = maskSensitiveData(value, seen);
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
    try {
      return maskSensitiveData(obj) as Record<string, unknown>;
    } catch {
      return obj;
    }
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
