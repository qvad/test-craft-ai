/**
 * TestCraft AI - Complete Node Type Definitions
 * Based on JMeter components with AI enhancements
 *
 * JMeter Reference: https://jmeter.apache.org/usermanual/component_reference.html
 */

// ============================================================================
// NODE TYPE CATEGORIES
// ============================================================================

/**
 * All supported node types organized by category
 */
export type NodeType =
  // Core
  | 'root'
  | 'thread-group'
  | 'setup-thread-group'
  | 'teardown-thread-group'

  // Samplers (Request Types)
  | 'http-request'
  | 'jdbc-request'
  | 'jms-publisher'
  | 'jms-subscriber'
  | 'tcp-sampler'
  | 'smtp-sampler'
  | 'ftp-request'
  | 'ldap-request'
  | 'graphql-request'
  | 'grpc-request'
  | 'websocket-request'
  | 'kafka-producer'
  | 'kafka-consumer'
  | 'mongodb-request'
  | 'redis-request'
  | 'shell-command'
  | 'script-sampler'

  // Logic Controllers
  | 'loop-controller'
  | 'while-controller'
  | 'foreach-controller'
  | 'if-controller'
  | 'switch-controller'
  | 'transaction-controller'
  | 'throughput-controller'
  | 'runtime-controller'
  | 'interleave-controller'
  | 'random-controller'
  | 'random-order-controller'
  | 'once-only-controller'
  | 'module-controller'
  | 'include-controller'
  | 'parallel-controller'

  // Timers
  | 'constant-timer'
  | 'uniform-random-timer'
  | 'gaussian-random-timer'
  | 'poisson-random-timer'
  | 'constant-throughput-timer'
  | 'precise-throughput-timer'
  | 'synchronizing-timer'

  // Pre-Processors
  | 'user-parameters'
  | 'html-link-parser'
  | 'http-url-rewriting-modifier'
  | 'beanshell-preprocessor'
  | 'jsr223-preprocessor'

  // Post-Processors / Extractors
  | 'regex-extractor'
  | 'json-extractor'
  | 'xpath-extractor'
  | 'css-extractor'
  | 'boundary-extractor'
  | 'result-status-handler'
  | 'beanshell-postprocessor'
  | 'jsr223-postprocessor'

  // Assertions
  | 'response-assertion'
  | 'json-assertion'
  | 'json-schema-assertion'
  | 'xpath-assertion'
  | 'duration-assertion'
  | 'size-assertion'
  | 'md5hex-assertion'
  | 'compare-assertion'
  | 'html-assertion'
  | 'xml-assertion'
  | 'beanshell-assertion'
  | 'jsr223-assertion'

  // Config Elements
  | 'csv-data-set'
  | 'http-request-defaults'
  | 'http-header-manager'
  | 'http-cookie-manager'
  | 'http-cache-manager'
  | 'http-authorization-manager'
  | 'jdbc-connection-config'
  | 'keystore-config'
  | 'login-config'
  | 'counter'
  | 'random-variable'
  | 'user-defined-variables'
  | 'dns-cache-manager'

  // Listeners (for results collection)
  | 'view-results-tree'
  | 'summary-report'
  | 'aggregate-report'
  | 'backend-listener'
  | 'simple-data-writer'

  // AI-Powered Nodes (TestCraft Exclusive)
  | 'ai-test-generator'
  | 'ai-data-generator'
  | 'ai-response-validator'
  | 'ai-load-predictor'
  | 'ai-anomaly-detector'
  | 'ai-scenario-builder'
  | 'ai-assertion'
  | 'ai-extractor'
  | 'ai-script';

// ============================================================================
// NODE CATEGORIES
// ============================================================================

export const NODE_CATEGORIES = {
  core: ['root', 'thread-group', 'setup-thread-group', 'teardown-thread-group'],

  samplers: [
    'http-request', 'jdbc-request', 'jms-publisher', 'jms-subscriber',
    'tcp-sampler', 'smtp-sampler', 'ftp-request', 'ldap-request',
    'graphql-request', 'grpc-request', 'websocket-request',
    'kafka-producer', 'kafka-consumer', 'mongodb-request', 'redis-request',
    'shell-command', 'script-sampler'
  ],

  controllers: [
    'loop-controller', 'while-controller', 'foreach-controller', 'if-controller',
    'switch-controller', 'transaction-controller', 'throughput-controller',
    'runtime-controller', 'interleave-controller', 'random-controller',
    'random-order-controller', 'once-only-controller', 'module-controller',
    'include-controller', 'parallel-controller'
  ],

  timers: [
    'constant-timer', 'uniform-random-timer', 'gaussian-random-timer',
    'poisson-random-timer', 'constant-throughput-timer', 'precise-throughput-timer',
    'synchronizing-timer'
  ],

  preprocessors: [
    'user-parameters', 'html-link-parser', 'http-url-rewriting-modifier',
    'beanshell-preprocessor', 'jsr223-preprocessor'
  ],

  postprocessors: [
    'regex-extractor', 'json-extractor', 'xpath-extractor', 'css-extractor',
    'boundary-extractor', 'result-status-handler', 'beanshell-postprocessor',
    'jsr223-postprocessor'
  ],

  assertions: [
    'response-assertion', 'json-assertion', 'json-schema-assertion',
    'xpath-assertion', 'duration-assertion', 'size-assertion', 'md5hex-assertion',
    'compare-assertion', 'html-assertion', 'xml-assertion',
    'beanshell-assertion', 'jsr223-assertion'
  ],

  config: [
    'csv-data-set', 'http-request-defaults', 'http-header-manager',
    'http-cookie-manager', 'http-cache-manager', 'http-authorization-manager',
    'jdbc-connection-config', 'keystore-config', 'login-config',
    'counter', 'random-variable', 'user-defined-variables', 'dns-cache-manager'
  ],

  listeners: [
    'view-results-tree', 'summary-report', 'aggregate-report',
    'backend-listener', 'simple-data-writer'
  ],

  ai: [
    'ai-test-generator', 'ai-data-generator', 'ai-response-validator',
    'ai-load-predictor', 'ai-anomaly-detector', 'ai-scenario-builder',
    'ai-assertion', 'ai-extractor', 'ai-script'
  ]
} as const;

// ============================================================================
// BASE CONFIGURATIONS
// ============================================================================

export interface BaseNodeConfig {
  description: string;
  timeout: number;
  retryCount: number;
  retryDelay: number;
  continueOnError: boolean;
  enabled: boolean;
  comments?: string;
}

// ============================================================================
// SAMPLER CONFIGURATIONS
// ============================================================================

export interface HttpRequestConfig extends BaseNodeConfig {
  type: 'http-request';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  protocol: 'http' | 'https';
  serverName: string;
  port: number;
  path: string;
  encoding: string;
  followRedirects: boolean;
  useKeepAlive: boolean;
  connectTimeout: number;
  responseTimeout: number;
  headers: Record<string, string>;
  parameters: Array<{ name: string; value: string; encoded: boolean }>;
  bodyData?: string;
  bodyType?: 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
  files?: Array<{ paramName: string; path: string; mimeType: string }>;
  proxy?: { host: string; port: number; username?: string; password?: string };

  // AI enhancement
  aiIntent?: string;  // Natural language description for AI to generate request
}

export interface JdbcRequestConfig extends BaseNodeConfig {
  type: 'jdbc-request';
  connectionRef: string;
  queryType: 'select' | 'update' | 'callable' | 'prepared-select' | 'prepared-update' | 'commit' | 'rollback' | 'autocommit-on' | 'autocommit-off';
  query: string;
  parameterValues?: string;
  parameterTypes?: string;
  variableNames?: string;
  resultVariable?: string;
  queryTimeout: number;
  resultSetMaxRows: number;
  handleResultSet: 'store' | 'count' | 'none';

  // AI enhancement
  aiIntent?: string;  // "Get all users who logged in last 7 days"
  aiSchemaHints?: { tables: string[]; columns: string[] };
}

export interface GraphQLRequestConfig extends BaseNodeConfig {
  type: 'graphql-request';
  endpoint: string;
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
  headers: Record<string, string>;

  // AI enhancement
  aiIntent?: string;
}

export interface GrpcRequestConfig extends BaseNodeConfig {
  type: 'grpc-request';
  serverAddress: string;
  protoFile: string;
  serviceName: string;
  methodName: string;
  requestData: string;
  metadata: Record<string, string>;
  deadlineMs: number;
  useTls: boolean;
}

export interface WebSocketRequestConfig extends BaseNodeConfig {
  type: 'websocket-request';
  serverUrl: string;
  connectionTimeout: number;
  messageType: 'text' | 'binary';
  requestData: string;
  responsePattern?: string;
  closeConnection: boolean;
}

export interface KafkaProducerConfig extends BaseNodeConfig {
  type: 'kafka-producer';
  bootstrapServers: string;
  topic: string;
  key?: string;
  message: string;
  partition?: number;
  headers: Record<string, string>;
  compressionType: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  acks: 'all' | '1' | '0';
}

export interface KafkaConsumerConfig extends BaseNodeConfig {
  type: 'kafka-consumer';
  bootstrapServers: string;
  topic: string;
  groupId: string;
  autoOffsetReset: 'earliest' | 'latest' | 'none';
  maxPollRecords: number;
  pollTimeout: number;
}

export interface MongoDBRequestConfig extends BaseNodeConfig {
  type: 'mongodb-request';
  connectionString: string;
  database: string;
  collection: string;
  operation: 'find' | 'findOne' | 'insertOne' | 'insertMany' | 'updateOne' | 'updateMany' | 'deleteOne' | 'deleteMany' | 'aggregate' | 'count';
  filter?: string;
  document?: string;
  update?: string;
  pipeline?: string;
  options?: Record<string, unknown>;
}

export interface RedisRequestConfig extends BaseNodeConfig {
  type: 'redis-request';
  host: string;
  port: number;
  database: number;
  password?: string;
  command: string;
  arguments: string[];
}

export interface ShellCommandConfig extends BaseNodeConfig {
  type: 'shell-command';
  command: string;
  arguments: string[];
  workingDirectory?: string;
  environmentVariables: Record<string, string>;
  expectedReturnCode: number;
}

// ============================================================================
// CONTROLLER CONFIGURATIONS
// ============================================================================

export interface ThreadGroupConfig extends BaseNodeConfig {
  type: 'thread-group';
  numThreads: number;
  rampUpPeriod: number;
  loopCount: number | 'forever';
  scheduler: boolean;
  duration?: number;
  delay?: number;
  sameUserOnNextIteration: boolean;
  delayedStart: boolean;
  onSampleError: 'continue' | 'start-next-loop' | 'stop-thread' | 'stop-test' | 'stop-test-now';
}

export interface LoopControllerConfig extends BaseNodeConfig {
  type: 'loop-controller';
  loopCount: number | 'forever';
}

export interface WhileControllerConfig extends BaseNodeConfig {
  type: 'while-controller';
  condition: string;
}

export interface ForEachControllerConfig extends BaseNodeConfig {
  type: 'foreach-controller';
  inputVariable: string;
  outputVariable: string;
  startIndex?: number;
  endIndex?: number;
  useSeparator: boolean;
}

export interface IfControllerConfig extends BaseNodeConfig {
  type: 'if-controller';
  condition: string;
  useExpression: boolean;
  evaluateForAllChildren: boolean;
}

export interface SwitchControllerConfig extends BaseNodeConfig {
  type: 'switch-controller';
  switchValue: string;
}

export interface TransactionControllerConfig extends BaseNodeConfig {
  type: 'transaction-controller';
  generateParentSample: boolean;
  includeTimers: boolean;
}

export interface ThroughputControllerConfig extends BaseNodeConfig {
  type: 'throughput-controller';
  style: 'percent-executions' | 'total-executions';
  throughput: number;
  perThread: boolean;
}

export interface ParallelControllerConfig extends BaseNodeConfig {
  type: 'parallel-controller';
  maxThreads: number;
  generateParentSample: boolean;
}

// ============================================================================
// TIMER CONFIGURATIONS
// ============================================================================

export interface ConstantTimerConfig extends BaseNodeConfig {
  type: 'constant-timer';
  delay: number;  // milliseconds
}

export interface UniformRandomTimerConfig extends BaseNodeConfig {
  type: 'uniform-random-timer';
  delay: number;
  range: number;
}

export interface GaussianRandomTimerConfig extends BaseNodeConfig {
  type: 'gaussian-random-timer';
  delay: number;
  deviation: number;
}

export interface PoissonRandomTimerConfig extends BaseNodeConfig {
  type: 'poisson-random-timer';
  delay: number;  // lambda
}

export interface ConstantThroughputTimerConfig extends BaseNodeConfig {
  type: 'constant-throughput-timer';
  targetThroughput: number;  // samples per minute
  calcMode: 'this-thread-only' | 'all-active-threads' | 'all-active-threads-shared' | 'all-active-threads-group' | 'all-active-threads-group-shared';
}

export interface SynchronizingTimerConfig extends BaseNodeConfig {
  type: 'synchronizing-timer';
  groupSize: number;
  timeoutMs: number;
}

// ============================================================================
// EXTRACTOR CONFIGURATIONS
// ============================================================================

export interface RegexExtractorConfig extends BaseNodeConfig {
  type: 'regex-extractor';
  applyTo: 'body' | 'headers' | 'url' | 'response-code' | 'response-message';
  variableName: string;
  regularExpression: string;
  template: string;
  matchNumber: number;  // 0 = random, -1 = all, n = specific
  defaultValue: string;
}

export interface JsonExtractorConfig extends BaseNodeConfig {
  type: 'json-extractor';
  variableName: string;
  jsonPath: string;
  matchNumber: number;
  defaultValue: string;
  computeConcatenation: boolean;
}

export interface XPathExtractorConfig extends BaseNodeConfig {
  type: 'xpath-extractor';
  variableName: string;
  xpathQuery: string;
  matchNumber: number;
  defaultValue: string;
  fragment: boolean;
  namespaces?: Record<string, string>;
}

export interface CssExtractorConfig extends BaseNodeConfig {
  type: 'css-extractor';
  variableName: string;
  cssSelector: string;
  attribute?: string;
  matchNumber: number;
  defaultValue: string;
}

export interface BoundaryExtractorConfig extends BaseNodeConfig {
  type: 'boundary-extractor';
  variableName: string;
  leftBoundary: string;
  rightBoundary: string;
  matchNumber: number;
  defaultValue: string;
}

// ============================================================================
// ASSERTION CONFIGURATIONS
// ============================================================================

export interface ResponseAssertionConfig extends BaseNodeConfig {
  type: 'response-assertion';
  applyTo: 'main-sample' | 'sub-samples' | 'main-and-sub' | 'jmeter-variable';
  variableName?: string;
  testField: 'response-text' | 'response-code' | 'response-message' | 'response-headers' | 'request-headers' | 'url' | 'document';
  testType: 'contains' | 'matches' | 'equals' | 'substring' | 'not';
  patterns: string[];
  ignoreStatus: boolean;
}

export interface JsonAssertionConfig extends BaseNodeConfig {
  type: 'json-assertion';
  jsonPath: string;
  expectedValue?: string;
  expectNull: boolean;
  invert: boolean;
  isRegex: boolean;
}

export interface JsonSchemaAssertionConfig extends BaseNodeConfig {
  type: 'json-schema-assertion';
  schema: string;  // JSON Schema
}

export interface DurationAssertionConfig extends BaseNodeConfig {
  type: 'duration-assertion';
  maxDuration: number;  // milliseconds
}

export interface SizeAssertionConfig extends BaseNodeConfig {
  type: 'size-assertion';
  applyTo: 'response' | 'headers' | 'body' | 'message';
  size: number;
  comparison: 'equal' | 'not-equal' | 'greater' | 'less' | 'greater-equal' | 'less-equal';
}

// ============================================================================
// CONFIG ELEMENT CONFIGURATIONS
// ============================================================================

export interface CsvDataSetConfig extends BaseNodeConfig {
  type: 'csv-data-set';
  filename: string;
  fileEncoding: string;
  variableNames: string;
  ignoreFirstLine: boolean;
  delimiter: string;
  allowQuotedData: boolean;
  recycle: boolean;
  stopThread: boolean;
  sharingMode: 'all-threads' | 'thread-group' | 'thread';
}

export interface HttpRequestDefaultsConfig extends BaseNodeConfig {
  type: 'http-request-defaults';
  protocol: string;
  serverName: string;
  port: number;
  path: string;
  encoding: string;
  connectTimeout: number;
  responseTimeout: number;
}

export interface HttpHeaderManagerConfig extends BaseNodeConfig {
  type: 'http-header-manager';
  headers: Array<{ name: string; value: string }>;
}

export interface HttpCookieManagerConfig extends BaseNodeConfig {
  type: 'http-cookie-manager';
  clearEachIteration: boolean;
  policy: 'standard' | 'standard-strict' | 'ignore' | 'netscape' | 'rfc2109' | 'rfc2965' | 'best-match' | 'default';
  implementationClass?: string;
  cookies: Array<{ name: string; value: string; domain: string; path: string; secure: boolean }>;
}

export interface JdbcConnectionConfig extends BaseNodeConfig {
  type: 'jdbc-connection-config';
  variableName: string;
  maxConnections: number;
  maxWait: number;
  autoCommit: boolean;
  transactionIsolation: 'default' | 'none' | 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
  preinit: boolean;
  initQuery?: string;
  databaseUrl: string;
  driverClass: string;
  username: string;
  password: string;
  connectionProperties?: Record<string, string>;
}

export interface CounterConfig extends BaseNodeConfig {
  type: 'counter';
  variableName: string;
  start: number;
  increment: number;
  maximum?: number;
  format?: string;
  perThread: boolean;
  resetOnThreadGroupIteration: boolean;
}

export interface RandomVariableConfig extends BaseNodeConfig {
  type: 'random-variable';
  variableName: string;
  minimumValue: number;
  maximumValue: number;
  outputFormat?: string;
  perThread: boolean;
  seed?: number;
}

export interface UserDefinedVariablesConfig extends BaseNodeConfig {
  type: 'user-defined-variables';
  variables: Array<{ name: string; value: string; description?: string }>;
}

// ============================================================================
// AI NODE CONFIGURATIONS
// ============================================================================

export interface AITestGeneratorConfig extends BaseNodeConfig {
  type: 'ai-test-generator';
  intent: string;  // "Generate API tests for user registration"
  targetLanguage: string;
  context: {
    apiSpec?: string;  // OpenAPI spec
    databaseSchema?: string;
    existingTests?: string[];
    requirements?: string[];
  };
  generateAssertions: boolean;
  generateDataVariations: boolean;
  coverageGoals: ('happy-path' | 'edge-cases' | 'error-handling' | 'security' | 'performance')[];
}

export interface AIDataGeneratorConfig extends BaseNodeConfig {
  type: 'ai-data-generator';
  intent: string;  // "Generate realistic user profiles"
  schema: {
    fields: Array<{
      name: string;
      type: string;
      constraints?: Record<string, unknown>;
      examples?: string[];
    }>;
  };
  count: number;
  locale?: string;
  seed?: number;
  outputVariable: string;
  useRAG: boolean;  // Use RAG for context-aware generation
  ragContext?: string[];  // Reference documents for RAG
}

export interface AIResponseValidatorConfig extends BaseNodeConfig {
  type: 'ai-response-validator';
  intent: string;  // "Verify the response contains valid user data"
  expectedBehavior: string;
  validationRules: string[];
  strictMode: boolean;
  confidenceThreshold: number;  // 0-1
}

export interface AILoadPredictorConfig extends BaseNodeConfig {
  type: 'ai-load-predictor';
  historicalData: string;  // Reference to historical metrics
  predictionWindow: number;  // minutes
  targetMetrics: ('response-time' | 'throughput' | 'error-rate' | 'cpu' | 'memory')[];
  alertThresholds: Record<string, number>;
}

export interface AIAnomalyDetectorConfig extends BaseNodeConfig {
  type: 'ai-anomaly-detector';
  monitoredMetrics: string[];
  sensitivityLevel: 'low' | 'medium' | 'high';
  baselineWindow: number;  // samples to consider for baseline
  alertOnAnomaly: boolean;
  autoAdjustThresholds: boolean;
}

export interface AIScenarioBuilderConfig extends BaseNodeConfig {
  type: 'ai-scenario-builder';
  intent: string;  // "Create a realistic e-commerce checkout flow"
  userPersonas: string[];
  businessRules: string[];
  includeEdgeCases: boolean;
  variationCount: number;
}

export interface AIAssertionConfig extends BaseNodeConfig {
  type: 'ai-assertion';
  intent: string;  // "The response should be a valid product with price > 0"
  responseVariable: string;
  confidenceThreshold: number;
  failOnLowConfidence: boolean;
}

export interface AIExtractorConfig extends BaseNodeConfig {
  type: 'ai-extractor';
  intent: string;  // "Extract the order confirmation number"
  sourceVariable: string;
  outputVariable: string;
  outputFormat?: string;
}

export interface AIScriptConfig extends BaseNodeConfig {
  type: 'ai-script';
  intent: string;  // Natural language description of what the script should do
  language: 'java' | 'python' | 'javascript' | 'typescript' | 'groovy' | 'kotlin';
  inputs: Array<{ name: string; type: string; description: string }>;
  outputs: Array<{ name: string; type: string; description: string }>;
  sideEffects?: string[];
  useRAG: boolean;  // Use RAG for better code generation
}

// ============================================================================
// LISTENER CONFIGURATIONS
// ============================================================================

export interface BackendListenerConfig extends BaseNodeConfig {
  type: 'backend-listener';
  implementation: 'influxdb' | 'graphite' | 'prometheus' | 'custom';
  parameters: Record<string, string>;
  asyncQueueSize: number;
}

// ============================================================================
// UNION TYPES
// ============================================================================

export type NodeConfig =
  | HttpRequestConfig
  | JdbcRequestConfig
  | GraphQLRequestConfig
  | GrpcRequestConfig
  | WebSocketRequestConfig
  | KafkaProducerConfig
  | KafkaConsumerConfig
  | MongoDBRequestConfig
  | RedisRequestConfig
  | ShellCommandConfig
  | ThreadGroupConfig
  | LoopControllerConfig
  | WhileControllerConfig
  | ForEachControllerConfig
  | IfControllerConfig
  | SwitchControllerConfig
  | TransactionControllerConfig
  | ThroughputControllerConfig
  | ParallelControllerConfig
  | ConstantTimerConfig
  | UniformRandomTimerConfig
  | GaussianRandomTimerConfig
  | PoissonRandomTimerConfig
  | ConstantThroughputTimerConfig
  | SynchronizingTimerConfig
  | RegexExtractorConfig
  | JsonExtractorConfig
  | XPathExtractorConfig
  | CssExtractorConfig
  | BoundaryExtractorConfig
  | ResponseAssertionConfig
  | JsonAssertionConfig
  | JsonSchemaAssertionConfig
  | DurationAssertionConfig
  | SizeAssertionConfig
  | CsvDataSetConfig
  | HttpRequestDefaultsConfig
  | HttpHeaderManagerConfig
  | HttpCookieManagerConfig
  | JdbcConnectionConfig
  | CounterConfig
  | RandomVariableConfig
  | UserDefinedVariablesConfig
  | AITestGeneratorConfig
  | AIDataGeneratorConfig
  | AIResponseValidatorConfig
  | AILoadPredictorConfig
  | AIAnomalyDetectorConfig
  | AIScenarioBuilderConfig
  | AIAssertionConfig
  | AIExtractorConfig
  | AIScriptConfig
  | BackendListenerConfig;
