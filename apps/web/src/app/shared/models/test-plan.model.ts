import { TreeNode, ValidationStatus } from './node.model';

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
  variables: Variable[];
  isDefault: boolean;
}

/**
 * Language-specific dependency configurations.
 * These are installed before code execution in runner containers.
 */
export interface LanguageDependencies {
  /** Python packages (pip install) */
  python?: {
    packages: string[];  // e.g., ["requests==2.31.0", "sqlalchemy>=2.0"]
    requirements?: string;  // Raw requirements.txt content
  };
  /** JavaScript/TypeScript packages (npm install) */
  javascript?: {
    packages: string[];  // e.g., ["axios@1.6.0", "lodash"]
    packageJson?: string;  // Raw package.json content
  };
  /** Java dependencies (Maven/Gradle) */
  java?: {
    maven?: string[];  // e.g., ["com.oracle.database.jdbc:ojdbc11:23.3.0.23.09"]
    jars?: string[];  // URLs to JAR files to download
    gradleDeps?: string[];  // Gradle dependency notation
  };
  /** C# packages (NuGet) */
  csharp?: {
    packages: string[];  // e.g., ["Newtonsoft.Json@13.0.3", "Dapper"]
  };
  /** Go modules */
  go?: {
    modules: string[];  // e.g., ["github.com/lib/pq@v1.10.9"]
  };
  /** Ruby gems */
  ruby?: {
    gems: string[];  // e.g., ["pg:1.5.4", "redis"]
  };
  /** Rust crates */
  rust?: {
    crates: string[];  // e.g., ["tokio@1.35", "serde"]
  };
  /** PHP packages (Composer) */
  php?: {
    packages: string[];  // e.g., ["guzzlehttp/guzzle:^7.0"]
  };
  /** Kotlin dependencies (same as Java, uses Maven/Gradle) */
  kotlin?: {
    maven?: string[];
    jars?: string[];
  };
}

export type TestPlanStatus = 'draft' | 'ready' | 'running' | 'completed' | 'failed';

export interface TestPlan {
  id: string;
  name: string;
  description: string;
  rootNodeId: string;
  variables: Variable[];
  environments: Environment[];
  dependencies?: LanguageDependencies;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  status: TestPlanStatus;
}

export type ExecutionStatus =
  | 'queued'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkIO: number;
  customMetrics: Record<string, number>;
}

export interface ExecutionError {
  message: string;
  stack?: string;
  type: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'warning';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: unknown;
  error?: ExecutionError;
  logs: string[];
  metrics?: ExecutionMetrics;
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  nodeId?: string;
  message: string;
}

export interface TestExecution {
  id: string;
  testPlanId: string;
  testPlanName: string;
  environmentId: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  triggeredBy: string;
  results: NodeExecutionResult[];
  logs: ExecutionLog[];
  progress: number;
}
