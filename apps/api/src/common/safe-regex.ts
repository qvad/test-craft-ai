/**
 * Safe Regex Utilities
 * Prevents ReDoS attacks from user-supplied regex patterns.
 */

// Detects nested quantifiers that cause catastrophic backtracking:
// (a+)+, (a*)+, (a+)*, (a*){2,}, (\w+)+ etc.
const REDOS_PATTERN = /(\((?:[^()]*\+|\*|\{[0-9,]+\})[^()]*\))(?:\+|\*|\{[0-9,]+\})/;

// Maximum pattern length to prevent resource exhaustion during compilation
const MAX_PATTERN_LENGTH = 1024;

/**
 * Validate a regex pattern and return a RegExp if safe, or throw with a clear message.
 */
export function safeRegex(pattern: string, flags?: string): RegExp {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(`Regex pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH})`);
  }

  if (REDOS_PATTERN.test(pattern)) {
    throw new Error('Regex pattern rejected: contains nested quantifiers (potential ReDoS)');
  }

  return new RegExp(pattern, flags);
}

/**
 * Safely test a string against a user-supplied regex pattern.
 * Returns false (instead of throwing) if the pattern is dangerous.
 */
export function safeRegexTest(pattern: string, input: string, flags?: string): boolean {
  try {
    return safeRegex(pattern, flags).test(input);
  } catch {
    return false;
  }
}

/**
 * Safely exec a user-supplied regex pattern against a string.
 * Returns null (instead of throwing) if the pattern is dangerous.
 */
export function safeRegexExec(pattern: string, input: string, flags?: string): RegExpExecArray | null {
  try {
    return safeRegex(pattern, flags).exec(input);
  } catch {
    return null;
  }
}
