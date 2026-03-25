/**
 * AI Service Types for TestCraft
 */

export interface AIGenerationRequest {
  nodeId: string;
  nodeType: string;
  intent: string;
  language: string;
  context: AIContext;
  options?: AIGenerationOptions;
}

export interface AIContext {
  // Test plan context
  testPlanId?: string;
  testPlanName?: string;
  variables?: Record<string, unknown>;

  // Previous steps output
  previousSteps?: Array<{
    nodeId: string;
    nodeName: string;
    outputSchema?: unknown;
  }>;

  // Schema information
  databaseSchema?: DatabaseSchema;
  apiSpecification?: APISpecification;

  // RAG context
  ragDocuments?: RAGDocument[];
  ragQuery?: string;

  // Code conventions
  conventions?: CodeConventions;
}

export interface DatabaseSchema {
  tables: TableSchema[];
  views?: ViewSchema[];
  procedures?: ProcedureSchema[];
  relationships?: RelationshipSchema[];
}

export interface TableSchema {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  indexes?: IndexSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface ViewSchema {
  name: string;
  definition: string;
  columns: ColumnSchema[];
}

export interface ProcedureSchema {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    direction: 'in' | 'out' | 'inout';
  }>;
  returnType?: string;
}

export interface RelationshipSchema {
  name: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface APISpecification {
  openApiSpec?: unknown;
  graphqlSchema?: string;
  endpoints?: EndpointInfo[];
}

export interface EndpointInfo {
  method: string;
  path: string;
  summary?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}

export interface CodeConventions {
  namingConvention: 'camelCase' | 'snake_case' | 'PascalCase';
  errorHandling: 'exceptions' | 'result-types' | 'callbacks';
  loggingPattern?: string;
  testingFramework?: string;
}

export interface AIGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  includeTests?: boolean;
  includeComments?: boolean;
  optimizeFor?: 'readability' | 'performance' | 'brevity';
}

export interface AIGenerationResponse {
  success: boolean;
  code: string;
  entryPoint: {
    className?: string;
    methodName: string;
    signature: string;
  };
  dependencies: Array<{
    name: string;
    version: string;
    scope: 'compile' | 'runtime' | 'test';
  }>;
  contracts: {
    inputs: Array<{ name: string; type: string; required: boolean }>;
    outputs: Array<{ name: string; type: string }>;
    sideEffects: string[];
    exceptions: string[];
  };
  suggestedTests?: Array<{
    name: string;
    description: string;
    testCode: string;
  }>;
  confidence: number;
  reasoning: string;
  alternatives?: string[];
  tokensUsed: number;
}

// RAG Types
export interface RAGDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  score?: number;
}

export interface RAGQuery {
  query: string;
  topK?: number;
  filters?: Record<string, unknown>;
  includeMetadata?: boolean;
}

export interface RAGResult {
  documents: RAGDocument[];
  totalFound: number;
  queryTime: number;
}

// Embedding Types
export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  tokensUsed: number;
}

// AI Data Generation Types
export interface DataGenerationRequest {
  schema: DataSchema;
  count: number;
  locale?: string;
  seed?: number;
  ragContext?: string[];
}

export interface DataSchema {
  fields: DataField[];
  constraints?: DataConstraint[];
}

export interface DataField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'uuid' | 'enum' | 'object' | 'array';
  format?: string;
  nullable?: boolean;
  unique?: boolean;
  enumValues?: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  examples?: string[];
  aiHint?: string;  // Natural language hint for AI
}

export interface DataConstraint {
  type: 'unique-combination' | 'foreign-key' | 'check';
  fields: string[];
  expression?: string;
}

export interface DataGenerationResponse {
  data: unknown[];
  schema: DataSchema;
  seed: number;
  generatedAt: string;
}

// AI Validation Types
export interface ValidationRequest {
  response: unknown;
  intent: string;
  expectedBehavior: string;
  rules?: string[];
}

export interface ValidationResponse {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
}

// AI Anomaly Detection Types
export interface AnomalyDetectionRequest {
  metrics: MetricSample[];
  sensitivity: 'low' | 'medium' | 'high';
  baselineWindow?: number;
}

export interface MetricSample {
  timestamp: string;
  name: string;
  value: number;
  labels?: Record<string, string>;
}

export interface AnomalyDetectionResponse {
  anomalies: Anomaly[];
  baseline: Record<string, BaselineStats>;
  confidence: number;
}

export interface Anomaly {
  timestamp: string;
  metric: string;
  value: number;
  expectedRange: [number, number];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface BaselineStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: Record<string, number>;
}
