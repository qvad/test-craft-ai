/**
 * Centralized configuration for form field dropdown options.
 * Used across node configuration forms and other UI components.
 *
 * @fileoverview Contains all dropdown option definitions for form fields.
 * Import specific options as needed in components.
 */

/**
 * Standard option format for PrimeNG dropdowns.
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
}

// ============================================================
// HTTP Request Options
// ============================================================

/** HTTP methods for request configuration */
export const HTTP_METHODS: SelectOption[] = [
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
].map((v) => ({ label: v, value: v }));

/** HTTP/HTTPS protocols */
export const PROTOCOLS: SelectOption[] = [
  { label: 'HTTPS', value: 'https' },
  { label: 'HTTP', value: 'http' }
];

// ============================================================
// Database Options
// ============================================================

/** JDBC query types */
export const QUERY_TYPES: SelectOption[] = [
  { label: 'Select', value: 'select' },
  { label: 'Update', value: 'update' },
  { label: 'Callable', value: 'callable' },
  { label: 'Prepared Select', value: 'prepared-select' },
  { label: 'Prepared Update', value: 'prepared-update' }
];

// ============================================================
// Script Options
// ============================================================

/** Supported scripting languages */
export const SCRIPT_LANGUAGES: SelectOption[] = [
  { label: 'Groovy', value: 'groovy' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Java', value: 'java' },
  { label: 'Python', value: 'python' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: 'BeanShell', value: 'beanshell' }
];

// ============================================================
// Assertion Options
// ============================================================

/** Response fields for assertions */
export const TEST_FIELDS: SelectOption[] = [
  { label: 'Response Data', value: 'response-data' },
  { label: 'Response Code', value: 'response-code' },
  { label: 'Response Message', value: 'response-message' },
  { label: 'Response Headers', value: 'response-headers' },
  { label: 'Request Data', value: 'request-data' },
  { label: 'URL', value: 'url' }
];

/** Assertion test types */
export const TEST_TYPES: SelectOption[] = [
  { label: 'Contains', value: 'contains' },
  { label: 'Matches', value: 'matches' },
  { label: 'Equals', value: 'equals' },
  { label: 'Substring', value: 'substring' }
];

// ============================================================
// AI Provider Options
// ============================================================

/** Poe.com AI bot options */
export const POE_BOTS: SelectOption[] = [
  { label: 'Claude-3.5-Sonnet', value: 'Claude-3.5-Sonnet' },
  { label: 'Claude-3-Opus', value: 'Claude-3-Opus' },
  { label: 'GPT-4o', value: 'GPT-4o' },
  { label: 'GPT-4-Turbo', value: 'GPT-4-Turbo' },
  { label: 'Gemini-Pro', value: 'Gemini-Pro' },
  { label: 'Llama-3.1-405B', value: 'Llama-3.1-405B' },
  { label: 'Llama-3.1-70B', value: 'Llama-3.1-70B' },
  { label: 'Mixtral-8x22B', value: 'Mixtral-8x22B' }
];

// ============================================================
// Infrastructure Options
// ============================================================

/** Docker image pull policies */
export const PULL_POLICIES: SelectOption[] = [
  { label: 'If Not Present', value: 'ifNotPresent' },
  { label: 'Always', value: 'always' },
  { label: 'Never', value: 'never' }
];

/** Kubernetes deployment types */
export const DEPLOYMENT_TYPES: SelectOption[] = [
  { label: 'Deployment', value: 'deployment' },
  { label: 'StatefulSet', value: 'statefulset' },
  { label: 'DaemonSet', value: 'daemonset' },
  { label: 'Job', value: 'job' },
  { label: 'CronJob', value: 'cronjob' }
];

/** Docker network modes */
export const NETWORK_MODES: SelectOption[] = [
  { label: 'Bridge', value: 'bridge' },
  { label: 'Host', value: 'host' },
  { label: 'None', value: 'none' }
];
