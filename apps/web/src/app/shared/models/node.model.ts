export type NodeType =
  | 'root'
  | 'thread-group'
  | 'http-request'
  | 'jdbc-request'
  | 'script'
  | 'assertion'
  | 'response-assertion'
  | 'json-assertion'
  | 'xpath-assertion'
  | 'duration-assertion'
  | 'size-assertion'
  | 'extractor'
  | 'json-extractor'
  | 'regex-extractor'
  | 'xpath-extractor'
  | 'boundary-extractor'
  | 'css-extractor'
  | 'loop-controller'
  | 'if-controller'
  | 'while-controller'
  | 'foreach-controller'
  | 'transaction-controller'
  | 'simple-controller'
  | 'module-controller'
  | 'include-controller'
  | 'interleave-controller'
  | 'random-controller'
  | 'random-order-controller'
  | 'throughput-controller'
  | 'runtime-controller'
  | 'switch-controller'
  | 'once-only-controller'
  | 'recording-controller'
  | 'critical-section-controller'
  | 'constant-timer'
  | 'uniform-random-timer'
  | 'gaussian-random-timer'
  | 'poisson-random-timer'
  | 'constant-throughput-timer'
  | 'precise-throughput-timer'
  | 'synchronizing-timer'
  | 'beanshell-timer'
  | 'jsr223-timer'
  | 'config-element'
  | 'csv-data-set-config'
  | 'http-header-manager'
  | 'http-cookie-manager'
  | 'http-cache-manager'
  | 'http-request-defaults'
  | 'jdbc-connection-config'
  | 'user-defined-variables'
  | 'random-variable'
  | 'counter'
  | 'dns-cache-manager'
  | 'http-authorization-manager'
  | 'keystore-config'
  | 'login-config'
  | 'simple-config'
  | 'listener'
  | 'view-results-tree'
  | 'summary-report'
  | 'aggregate-report'
  | 'backend-listener'
  | 'simple-data-writer'
  | 'graph-results'
  | 'response-time-graph'
  | 'pre-processor'
  | 'beanshell-preprocessor'
  | 'jsr223-preprocessor'
  | 'html-link-parser'
  | 'http-url-rewriting'
  | 'user-parameters'
  | 'regex-user-parameters'
  | 'post-processor'
  | 'beanshell-postprocessor'
  | 'jsr223-postprocessor'
  | 'debug-postprocessor'
  | 'result-status-handler'
  | 'ai-task'
  | 'lm-studio'
  | 'poe-ai'
  | 'docker-run'
  | 'k8s-deploy'
  | 'github-release'
  | 'context-setup';

export interface BaseNodeConfig {
  description: string;
  timeout: number;
  retryCount: number;
  continueOnError: boolean;
}

export interface ThreadGroupConfig extends BaseNodeConfig {
  numThreads: number;
  rampUp: number;
  loops: number;
  scheduler: boolean;
  duration: number;
  delay: number;
}

export interface HttpRequestConfig extends BaseNodeConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  protocol: 'http' | 'https';
  serverName: string;
  port: number;
  path: string;
  contentEncoding: string;
  followRedirects: boolean;
  useKeepalive: boolean;
  bodyData: string;
  headers: Record<string, string>;
  parameters: { name: string; value: string; encode: boolean }[];
}

export interface JdbcRequestConfig extends BaseNodeConfig {
  connectionRef: string;
  queryType: 'select' | 'update' | 'callable' | 'prepared-select' | 'prepared-update';
  query: string;
  parameters: { name: string; value: string; type: string }[];
  resultVariable: string;
}

export interface ScriptConfig extends BaseNodeConfig {
  language: 'groovy' | 'javascript' | 'beanshell' | 'java' | 'kotlin' | 'python';
  script: string;
  scriptFile: string;
  parameters: string;
}

export interface AssertionConfig extends BaseNodeConfig {
  testField: 'response-data' | 'response-code' | 'response-message' | 'response-headers' | 'request-data' | 'url';
  testType: 'contains' | 'matches' | 'equals' | 'substring';
  testStrings: string[];
  negation: boolean;
  assumeSuccess: boolean;
}

export interface ExtractorConfig extends BaseNodeConfig {
  refName: string;
  expression: string;
  matchNumber: number;
  defaultValue: string;
  scope: 'all' | 'main' | 'sub' | 'children';
}

export interface ControllerConfig extends BaseNodeConfig {
  condition?: string;
  loops?: number;
  inputVariable?: string;
  outputVariable?: string;
  returnVariable?: string;
}

export interface TimerConfig extends BaseNodeConfig {
  delay: number;
  range: number;
  throughput: number;
}

export interface AiTaskConfig extends BaseNodeConfig {
  intent: string;
  language: 'java' | 'python' | 'javascript' | 'groovy' | 'kotlin';
  inputVariables: string[];
  outputVariables: string[];
  contextHints: string[];
}

export interface LmStudioConfig extends BaseNodeConfig {
  endpoint: string;
  model: string;
  prompt: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  responseVariable: string;
  inputVariables: string[];
  parseJsonResponse: boolean;
}

export interface PoeAiConfig extends BaseNodeConfig {
  botName: string;
  apiKey: string;
  prompt: string;
  systemPrompt: string;
  conversationId: string;
  responseVariable: string;
  inputVariables: string[];
  streamResponse: boolean;
}

export interface DockerRunConfig extends BaseNodeConfig {
  imageName: string;
  imageTag: string;
  registryUrl: string;
  registryUsername: string;
  registryPassword: string;
  command: string;
  args: string[];
  environment: Record<string, string>;
  volumes: { hostPath: string; containerPath: string; readOnly: boolean }[];
  ports: { hostPort: number; containerPort: number; protocol: 'tcp' | 'udp' }[];
  network: string;
  cpuLimit: string;
  memoryLimit: string;
  pullPolicy: 'always' | 'ifNotPresent' | 'never';
  removeAfterRun: boolean;
  waitForHealthy: boolean;
  healthCheckTimeout: number;
}

export interface K8sDeployConfig extends BaseNodeConfig {
  kubeconfig: string;
  namespace: string;
  deploymentType: 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob';
  manifestYaml: string;
  imageName: string;
  imageTag: string;
  replicas: number;
  serviceAccount: string;
  environment: Record<string, string>;
  configMaps: string[];
  secrets: string[];
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  waitForReady: boolean;
  readyTimeout: number;
  rollbackOnFailure: boolean;
}

export interface GithubReleaseConfig extends BaseNodeConfig {
  repository: string;
  releaseTag: string;
  assetPattern: string;
  downloadPath: string;
  extractArchive: boolean;
  githubToken: string;
  preRelease: boolean;
  outputVariable: string;
}

export interface DatabaseConnectionConfig {
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'yugabyte';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  options?: Record<string, string>;
}

export interface ContextSetupConfig extends BaseNodeConfig {
  connections: DatabaseConnectionConfig[];
  variables: { name: string; value: string }[];
}

export type NodeConfig =
  | BaseNodeConfig
  | ThreadGroupConfig
  | HttpRequestConfig
  | JdbcRequestConfig
  | ScriptConfig
  | AssertionConfig
  | ExtractorConfig
  | ControllerConfig
  | TimerConfig
  | AiTaskConfig
  | LmStudioConfig
  | PoeAiConfig
  | DockerRunConfig
  | K8sDeployConfig
  | GithubReleaseConfig
  | ContextSetupConfig;

export interface GeneratedCode {
  id: string;
  nodeId: string;
  language: string;
  code: string;
  entryPoint: string;
  dependencies: { name: string; version: string }[];
  generatedAt: Date;
  generatedBy: string;
  confidence: number;
  isValid: boolean;
  validationResults: ValidationResult[];
}

export interface ValidationResult {
  validatorId: string;
  validatorName: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: unknown;
  timestamp: Date;
}

export type ValidationStatus = 'pending' | 'validating' | 'valid' | 'invalid' | 'warning';

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
  expanded?: boolean;
}
