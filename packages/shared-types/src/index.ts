// Re-export node types
export * from './nodes.js';
export * from './hocon-schema.js';
import { NodeType, NodeConfig } from './nodes.js';

// Supported languages
export type SupportedLanguage =
  | 'java'
  | 'python'
  | 'csharp'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'kotlin';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
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
];

// Execution types
export interface ExecutionRequest {
  executionId?: string;
  language: SupportedLanguage;
  code: string;
  timeout?: number;
  inputs?: Record<string, unknown>;
  dependencies?: string[];
}

export interface ExecutionResult {
  executionId: string;
  status: 'success' | 'error' | 'timeout';
  language: SupportedLanguage;
  output?: string;
  error?: string;
  exitCode: number;
  duration: number;
  podName?: string;
  metrics?: ExecutionMetrics;
}

export interface ExecutionMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  startTime?: string;
  endTime?: string;
}

// NodeType is exported from nodes.ts via re-export

export type TestPlanStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed';

export type ExecutionStatus =
  | 'queued'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ValidationStatus =
  | 'pending'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'warning';

export interface TestPlan {
  id: string;
  name: string;
  description: string;
  rootNodeId: string;
  variables: Variable[];
  environments: Environment[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: TestPlanStatus;
}

export interface TreeNode {
  id: string;
  testPlanId: string;
  parentId: string | null;
  type: NodeType;
  name: string;
  order: number;
  enabled: boolean;
  config: NodeConfig;
  generatedCode: GeneratedCode | null;
  validationStatus: ValidationStatus;
  children: string[];
}

// BaseNodeConfig and NodeConfig are exported from nodes.ts via re-export

export interface GeneratedCode {
  id: string;
  nodeId: string;
  language: SupportedLanguage;
  code: string;
  entryPoint: string;
  dependencies: Dependency[];
  generatedAt: string;
  generatedBy: string;
  promptUsed: string;
  confidence: number;
  validationResults: ValidationResult[];
  isValid: boolean;
  testCode?: string;
  testResults?: TestResult[];
}

export interface Dependency {
  name: string;
  version: string;
  repository?: string;
}

export interface ValidationResult {
  validatorId: string;
  validatorName: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  scope: 'plan' | 'environment' | 'runtime';
  value: unknown;
  sensitive: boolean;
  description: string;
}

export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'connection'
  | 'credentials'
  | 'list'
  | 'map';

export interface Environment {
  id: string;
  name: string;
  description: string;
  variables: Record<string, unknown>;
  isDefault: boolean;
}

export interface TestExecution {
  id: string;
  testPlanId: string;
  environmentId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  results: NodeExecutionResult[];
  logs: ExecutionLog[];
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  output?: unknown;
  error?: ExecutionError;
  logs: string[];
  metrics: NodeExecutionMetrics;
}

export interface ExecutionError {
  message: string;
  stack?: string;
  type: string;
}

export interface ExecutionLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  nodeId?: string;
}

export interface NodeExecutionMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  networkIO?: number;
  customMetrics?: Record<string, number>;
}

// Language info
export interface LanguageInfo {
  language: SupportedLanguage;
  displayName: string;
  extension: string;
  fileTemplate: string;
}

export const LANGUAGE_INFO: Record<SupportedLanguage, LanguageInfo> = {
  java: {
    language: 'java',
    displayName: 'Java',
    extension: '.java',
    fileTemplate: 'Main.java',
  },
  python: {
    language: 'python',
    displayName: 'Python',
    extension: '.py',
    fileTemplate: 'main.py',
  },
  csharp: {
    language: 'csharp',
    displayName: 'C#',
    extension: '.cs',
    fileTemplate: 'Program.cs',
  },
  javascript: {
    language: 'javascript',
    displayName: 'JavaScript',
    extension: '.js',
    fileTemplate: 'main.js',
  },
  typescript: {
    language: 'typescript',
    displayName: 'TypeScript',
    extension: '.ts',
    fileTemplate: 'main.ts',
  },
  go: {
    language: 'go',
    displayName: 'Go',
    extension: '.go',
    fileTemplate: 'main.go',
  },
  rust: {
    language: 'rust',
    displayName: 'Rust',
    extension: '.rs',
    fileTemplate: 'main.rs',
  },
  ruby: {
    language: 'ruby',
    displayName: 'Ruby',
    extension: '.rb',
    fileTemplate: 'main.rb',
  },
  php: {
    language: 'php',
    displayName: 'PHP',
    extension: '.php',
    fileTemplate: 'main.php',
  },
  kotlin: {
    language: 'kotlin',
    displayName: 'Kotlin',
    extension: '.kt',
    fileTemplate: 'Main.kt',
  },
};
