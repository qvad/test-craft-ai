/**
 * Application Constants
 *
 * Centralized location for all magic numbers and configuration constants.
 * Prefer using config/index.ts for environment-variable-driven settings.
 */

// =========================================================================
// Execution Constants
// =========================================================================

export const EXECUTION_CONSTANTS = {
  /** Maximum time to wait for a pod to be ready (ms) */
  POD_READY_TIMEOUT_MS: 30000,

  /** Default script execution timeout (seconds) */
  DEFAULT_SCRIPT_TIMEOUT_SEC: 60,

  /** Maximum script execution timeout (seconds) */
  MAX_SCRIPT_TIMEOUT_SEC: 300,

  /** Polling interval when waiting for pod status (ms) */
  POD_STATUS_POLL_INTERVAL_MS: 1000,

  /** Maximum retry attempts for failed executions */
  MAX_RETRY_ATTEMPTS: 3,

  /** Delay between retry attempts (ms) */
  RETRY_DELAY_MS: 1000,
} as const;

// =========================================================================
// AI Constants
// =========================================================================

export const AI_CONSTANTS = {
  /** Default temperature for AI completions */
  DEFAULT_TEMPERATURE: 0.3,

  /** Default max tokens for code generation */
  DEFAULT_MAX_TOKENS: 4096,

  /** Maximum allowed tokens for AI requests */
  MAX_TOKENS_LIMIT: 16000,

  /** Token limit for embedding generation */
  EMBEDDING_TOKEN_LIMIT: 8191,

  /** Default top-k results for RAG search */
  DEFAULT_RAG_TOP_K: 5,

  /** Maximum top-k results for RAG search */
  MAX_RAG_TOP_K: 100,

  /** Confidence threshold for generated code validation */
  CODE_CONFIDENCE_THRESHOLD: 0.7,
} as const;

// =========================================================================
// Buffer & Cache Constants
// =========================================================================

export const BUFFER_CONSTANTS = {
  /** Maximum entries in log buffer */
  MAX_LOG_BUFFER_SIZE: 10000,

  /** Maximum execution history entries to keep in memory */
  MAX_EXECUTION_HISTORY: 50,

  /** WebSocket message queue size */
  WS_MESSAGE_QUEUE_SIZE: 1000,

  /** Cache TTL for RAG documents (ms) */
  RAG_CACHE_TTL_MS: 300000, // 5 minutes
} as const;

// =========================================================================
// HTTP Constants
// =========================================================================

export const HTTP_CONSTANTS = {
  /** Default request timeout (ms) */
  DEFAULT_REQUEST_TIMEOUT_MS: 30000,

  /** Maximum request body size (bytes) */
  MAX_BODY_SIZE_BYTES: 10 * 1024 * 1024, // 10MB

  /** Default page size for paginated results */
  DEFAULT_PAGE_SIZE: 20,

  /** Maximum page size for paginated results */
  MAX_PAGE_SIZE: 100,
} as const;

// =========================================================================
// Kubernetes Constants
// =========================================================================

export const K8S_CONSTANTS = {
  /** Label key for language identification */
  LANGUAGE_LABEL: 'testcraft.io/language',

  /** Label key for pool type */
  POOL_LABEL: 'testcraft.io/pool',

  /** Annotation key for creation timestamp */
  CREATED_AT_ANNOTATION: 'testcraft.io/created-at',

  /** Default resource requests for runner pods */
  DEFAULT_CPU_REQUEST: '100m',
  DEFAULT_MEMORY_REQUEST: '128Mi',

  /** Default resource limits for runner pods */
  DEFAULT_CPU_LIMIT: '500m',
  DEFAULT_MEMORY_LIMIT: '512Mi',

  /** Maximum pods in warm pool per language */
  MAX_WARM_POOL_SIZE: 5,
} as const;

// =========================================================================
// Validation Constants
// =========================================================================

export const VALIDATION_CONSTANTS = {
  /** Minimum length for node names */
  MIN_NODE_NAME_LENGTH: 1,

  /** Maximum length for node names */
  MAX_NODE_NAME_LENGTH: 100,

  /** Maximum length for descriptions */
  MAX_DESCRIPTION_LENGTH: 1000,

  /** Maximum variables per test plan */
  MAX_VARIABLES_PER_PLAN: 100,

  /** Maximum nodes per test plan */
  MAX_NODES_PER_PLAN: 500,
} as const;

// =========================================================================
// Supported Languages
// =========================================================================

export const SUPPORTED_LANGUAGES = [
  'java',
  'python',
  'csharp',
  'javascript',
  'typescript',
  'go',
  'rust',
  'ruby',
  'php',
  'kotlin',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
