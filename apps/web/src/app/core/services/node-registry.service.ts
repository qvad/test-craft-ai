import { Injectable } from '@angular/core';
import { NodeType, NodeConfig, BaseNodeConfig } from '../../shared/models';

/**
 * Categories of node types for grouping in the UI.
 */
export type NodeCategory =
  | 'test-plan'
  | 'thread-group'
  | 'sampler'
  | 'logic-controller'
  | 'config-element'
  | 'timer'
  | 'pre-processor'
  | 'post-processor'
  | 'assertion'
  | 'listener'
  | 'ai'
  | 'infrastructure';

/**
 * Metadata describing a node type's properties and constraints.
 */
export interface NodeTypeMetadata {
  /** Unique node type identifier */
  type: NodeType;
  /** Human-readable label for UI display */
  label: string;
  /** Brief description of node purpose */
  description: string;
  /** Category for grouping in add-node menus */
  category: NodeCategory;
  /** PrimeNG icon class (e.g., 'pi-globe') */
  icon: string;
  /** Color for visual distinction (hex) */
  color: string;
  /** Whether this node can contain child nodes */
  canHaveChildren: boolean;
  /** Node types that can be added as children */
  allowedChildren: NodeType[];
  /** Node types that can be parents of this node */
  allowedParents: NodeType[];
  /** Default configuration values for new nodes */
  defaultConfig: Partial<NodeConfig>;
}

/**
 * Default configuration shared by all node types.
 */
const baseConfig: BaseNodeConfig = {
  description: '',
  timeout: 30000,
  retryCount: 0,
  continueOnError: false
};

/**
 * Common parent arrays for node type constraints.
 * Reduces duplication in node registrations.
 */
const CONTROLLER_PARENTS: NodeType[] = [
  'thread-group', 'loop-controller', 'if-controller', 'while-controller',
  'foreach-controller', 'transaction-controller', 'simple-controller'
];

const TIMER_PARENTS: NodeType[] = [
  'thread-group', 'http-request', 'jdbc-request', 'script',
  'loop-controller', 'if-controller', 'while-controller',
  'foreach-controller', 'transaction-controller', 'simple-controller'
];

const ASSERTION_PARENTS: NodeType[] = [
  'http-request', 'jdbc-request', 'script', 'thread-group'
];

const EXTRACTOR_PARENTS: NodeType[] = [
  'http-request', 'jdbc-request', 'script', 'thread-group'
];

/**
 * Registry service for all supported node types in the test plan editor.
 * Provides metadata, validation rules, and default configurations for 60+ node types.
 *
 * @description
 * The NodeRegistryService:
 * - Defines all available node types (samplers, controllers, timers, etc.)
 * - Specifies parent/child relationships for drag-drop validation
 * - Provides default configurations for new nodes
 * - Organizes nodes into categories for the add-node menu
 *
 * Node categories:
 * - **test-plan**: Root element
 * - **thread-group**: User/load simulation
 * - **sampler**: HTTP, JDBC, script requests
 * - **logic-controller**: Loop, if, while, foreach
 * - **config-element**: Headers, cookies, variables
 * - **timer**: Delays between requests
 * - **pre-processor**: Pre-request scripts
 * - **post-processor**: Extractors, post-scripts
 * - **assertion**: Response validation
 * - **listener**: Results collection
 * - **ai**: AI-powered test steps
 * - **infrastructure**: Docker, K8s, GitHub
 *
 * @example
 * ```typescript
 * const registry = inject(NodeRegistryService);
 *
 * // Get metadata for a node type
 * const httpMeta = registry.get('http-request');
 * console.log(httpMeta.label); // "HTTP Request"
 *
 * // Get allowed children for drag-drop
 * const children = registry.getAllowedChildren('thread-group');
 *
 * // Check if a node can be added
 * const canAdd = registry.canAddChild('thread-group', 'http-request'); // true
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class NodeRegistryService {
  private readonly registry = new Map<NodeType, NodeTypeMetadata>();

  constructor() {
    this.registerAllNodeTypes();
  }

  /**
   * Registers all supported node types.
   * Called once during service initialization.
   */
  private registerAllNodeTypes(): void {
    // Test Plan Root
    this.register({
      type: 'root',
      label: 'Test Plan',
      description: 'Root element of a test plan',
      category: 'test-plan',
      icon: 'pi-folder',
      color: '#6366f1',
      canHaveChildren: true,
      allowedChildren: ['thread-group', 'config-element', 'listener'],
      allowedParents: [],
      defaultConfig: { ...baseConfig }
    });

    // Thread Groups
    this.register({
      type: 'thread-group',
      label: 'Thread Group',
      description: 'Simulates concurrent users',
      category: 'thread-group',
      icon: 'pi-users',
      color: '#8b5cf6',
      canHaveChildren: true,
      allowedChildren: [
        'http-request', 'jdbc-request', 'script', 'ai-task',
        'lm-studio', 'poe-ai', 'docker-run', 'k8s-deploy', 'github-release',
        'loop-controller', 'if-controller', 'while-controller', 'foreach-controller',
        'transaction-controller', 'simple-controller', 'module-controller',
        'constant-timer', 'uniform-random-timer', 'gaussian-random-timer',
        'response-assertion', 'json-assertion', 'duration-assertion',
        'json-extractor', 'regex-extractor', 'css-extractor',
        'beanshell-preprocessor', 'jsr223-preprocessor',
        'beanshell-postprocessor', 'jsr223-postprocessor', 'debug-postprocessor',
        'view-results-tree', 'summary-report', 'aggregate-report',
        'context-setup'
      ],
      allowedParents: ['root'],
      defaultConfig: {
        ...baseConfig,
        numThreads: 1,
        rampUp: 1,
        loops: 1,
        scheduler: false,
        duration: 0,
        delay: 0
      }
    });

    // Samplers
    this.register({
      type: 'http-request',
      label: 'HTTP Request',
      description: 'Send HTTP/HTTPS requests',
      category: 'sampler',
      icon: 'pi-globe',
      color: '#10b981',
      canHaveChildren: true,
      allowedChildren: [
        'response-assertion', 'json-assertion', 'duration-assertion',
        'json-extractor', 'regex-extractor', 'css-extractor',
        'constant-timer', 'beanshell-preprocessor', 'jsr223-preprocessor',
        'beanshell-postprocessor', 'jsr223-postprocessor'
      ],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        method: 'GET',
        protocol: 'https',
        serverName: '',
        port: 443,
        path: '/',
        contentEncoding: 'UTF-8',
        followRedirects: true,
        useKeepalive: true,
        bodyData: '',
        headers: {},
        parameters: []
      }
    });

    this.register({
      type: 'jdbc-request',
      label: 'JDBC Request',
      description: 'Execute database queries',
      category: 'sampler',
      icon: 'pi-database',
      color: '#f59e0b',
      canHaveChildren: true,
      allowedChildren: [
        'response-assertion', 'json-extractor', 'regex-extractor',
        'beanshell-postprocessor', 'jsr223-postprocessor'
      ],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        connectionRef: '',
        queryType: 'select',
        query: '',
        parameters: [],
        resultVariable: ''
      }
    });

    this.register({
      type: 'script',
      label: 'JSR223 Sampler',
      description: 'Execute custom scripts',
      category: 'sampler',
      icon: 'pi-code',
      color: '#ec4899',
      canHaveChildren: true,
      allowedChildren: ['response-assertion', 'json-extractor', 'regex-extractor'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        language: 'groovy',
        script: '',
        scriptFile: '',
        parameters: ''
      }
    });

    // Logic Controllers
    this.register({
      type: 'loop-controller',
      label: 'Loop Controller',
      description: 'Repeat child elements',
      category: 'logic-controller',
      icon: 'pi-replay',
      color: '#06b6d4',
      canHaveChildren: true,
      allowedChildren: ['http-request', 'jdbc-request', 'script', 'ai-task', 'if-controller', 'simple-controller', 'constant-timer', 'context-setup'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: { ...baseConfig, loops: 1 }
    });

    this.register({
      type: 'if-controller',
      label: 'If Controller',
      description: 'Conditional execution',
      category: 'logic-controller',
      icon: 'pi-directions',
      color: '#06b6d4',
      canHaveChildren: true,
      allowedChildren: ['http-request', 'jdbc-request', 'script', 'ai-task', 'loop-controller', 'simple-controller', 'constant-timer', 'context-setup'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: { ...baseConfig, condition: '' }
    });

    this.register({
      type: 'while-controller',
      label: 'While Controller',
      description: 'Loop while condition is true',
      category: 'logic-controller',
      icon: 'pi-sync',
      color: '#06b6d4',
      canHaveChildren: true,
      allowedChildren: ['http-request', 'jdbc-request', 'script', 'ai-task', 'loop-controller', 'if-controller', 'simple-controller', 'constant-timer', 'context-setup'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: { ...baseConfig, condition: '' }
    });

    this.register({
      type: 'foreach-controller',
      label: 'ForEach Controller',
      description: 'Iterate over variables',
      category: 'logic-controller',
      icon: 'pi-list',
      color: '#06b6d4',
      canHaveChildren: true,
      allowedChildren: ['http-request', 'jdbc-request', 'script', 'ai-task', 'if-controller', 'simple-controller', 'constant-timer', 'context-setup'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: { ...baseConfig, inputVariable: '', outputVariable: '' }
    });

    this.register({
      type: 'transaction-controller',
      label: 'Transaction Controller',
      description: 'Group samplers as a transaction',
      category: 'logic-controller',
      icon: 'pi-box',
      color: '#06b6d4',
      canHaveChildren: true,
      allowedChildren: ['http-request', 'jdbc-request', 'script', 'ai-task', 'loop-controller', 'if-controller', 'constant-timer', 'context-setup'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'simple-controller',
      label: 'Simple Controller',
      description: 'Group elements together',
      category: 'logic-controller',
      icon: 'pi-folder-open',
      color: '#06b6d4',
      canHaveChildren: true,
      allowedChildren: ['http-request', 'jdbc-request', 'script', 'ai-task', 'loop-controller', 'if-controller', 'while-controller', 'foreach-controller', 'transaction-controller', 'simple-controller', 'constant-timer', 'context-setup'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: { ...baseConfig }
    });

    // Timers
    this.register({
      type: 'constant-timer',
      label: 'Constant Timer',
      description: 'Fixed delay between requests',
      category: 'timer',
      icon: 'pi-clock',
      color: '#f97316',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: TIMER_PARENTS,
      defaultConfig: { ...baseConfig, delay: 1000 }
    });

    this.register({
      type: 'uniform-random-timer',
      label: 'Uniform Random Timer',
      description: 'Random delay within range',
      category: 'timer',
      icon: 'pi-clock',
      color: '#f97316',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: TIMER_PARENTS,
      defaultConfig: { ...baseConfig, delay: 1000, range: 500 }
    });

    this.register({
      type: 'gaussian-random-timer',
      label: 'Gaussian Random Timer',
      description: 'Gaussian distributed delay',
      category: 'timer',
      icon: 'pi-clock',
      color: '#f97316',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: TIMER_PARENTS,
      defaultConfig: { ...baseConfig, delay: 1000, range: 100 }
    });

    this.register({
      type: 'constant-throughput-timer',
      label: 'Constant Throughput Timer',
      description: 'Control request throughput',
      category: 'timer',
      icon: 'pi-chart-line',
      color: '#f97316',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['thread-group'],
      defaultConfig: { ...baseConfig, throughput: 60 }
    });

    // Assertions
    this.register({
      type: 'response-assertion',
      label: 'Response Assertion',
      description: 'Assert response content',
      category: 'assertion',
      icon: 'pi-check-circle',
      color: '#22c55e',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: {
        ...baseConfig,
        testField: 'response-data',
        testType: 'contains',
        testStrings: [],
        negation: false,
        assumeSuccess: false
      }
    });

    this.register({
      type: 'json-assertion',
      label: 'JSON Assertion',
      description: 'Assert JSON response',
      category: 'assertion',
      icon: 'pi-check-circle',
      color: '#22c55e',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['http-request', 'thread-group'],
      defaultConfig: { ...baseConfig, testField: 'response-data', testType: 'contains', testStrings: [] }
    });

    this.register({
      type: 'duration-assertion',
      label: 'Duration Assertion',
      description: 'Assert response time',
      category: 'assertion',
      icon: 'pi-stopwatch',
      color: '#22c55e',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, timeout: 5000 }
    });

    // Extractors (Post-Processors)
    this.register({
      type: 'json-extractor',
      label: 'JSON Extractor',
      description: 'Extract data using JSONPath',
      category: 'post-processor',
      icon: 'pi-filter',
      color: '#a855f7',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, refName: '', expression: '', matchNumber: 1, defaultValue: '' }
    });

    this.register({
      type: 'regex-extractor',
      label: 'Regular Expression Extractor',
      description: 'Extract data using regex',
      category: 'post-processor',
      icon: 'pi-filter',
      color: '#a855f7',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, refName: '', expression: '', matchNumber: 1, defaultValue: '' }
    });

    this.register({
      type: 'css-extractor',
      label: 'CSS Selector Extractor',
      description: 'Extract data using CSS selectors',
      category: 'post-processor',
      icon: 'pi-filter',
      color: '#a855f7',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['http-request', 'thread-group'],
      defaultConfig: { ...baseConfig, refName: '', expression: '', matchNumber: 1, defaultValue: '' }
    });

    this.register({
      type: 'beanshell-postprocessor',
      label: 'BeanShell PostProcessor',
      description: 'Post-process with BeanShell script',
      category: 'post-processor',
      icon: 'pi-code',
      color: '#a855f7',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, language: 'beanshell', script: '' }
    });

    this.register({
      type: 'jsr223-postprocessor',
      label: 'JSR223 PostProcessor',
      description: 'Post-process with JSR223 script',
      category: 'post-processor',
      icon: 'pi-code',
      color: '#a855f7',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, language: 'groovy', script: '' }
    });

    this.register({
      type: 'debug-postprocessor',
      label: 'Debug PostProcessor',
      description: 'Log variables for debugging',
      category: 'post-processor',
      icon: 'pi-bug',
      color: '#a855f7',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig }
    });

    // Pre-Processors
    this.register({
      type: 'beanshell-preprocessor',
      label: 'BeanShell PreProcessor',
      description: 'Pre-process with BeanShell script',
      category: 'pre-processor',
      icon: 'pi-code',
      color: '#0ea5e9',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, language: 'beanshell', script: '' }
    });

    this.register({
      type: 'jsr223-preprocessor',
      label: 'JSR223 PreProcessor',
      description: 'Pre-process with JSR223 script',
      category: 'pre-processor',
      icon: 'pi-code',
      color: '#0ea5e9',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: EXTRACTOR_PARENTS,
      defaultConfig: { ...baseConfig, language: 'groovy', script: '' }
    });

    // Config Elements
    this.register({
      type: 'http-header-manager',
      label: 'HTTP Header Manager',
      description: 'Manage HTTP headers',
      category: 'config-element',
      icon: 'pi-list',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group', 'http-request'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'http-cookie-manager',
      label: 'HTTP Cookie Manager',
      description: 'Manage cookies',
      category: 'config-element',
      icon: 'pi-th-large',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'http-request-defaults',
      label: 'HTTP Request Defaults',
      description: 'Default HTTP request settings',
      category: 'config-element',
      icon: 'pi-cog',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'jdbc-connection-config',
      label: 'JDBC Connection Configuration',
      description: 'Database connection settings',
      category: 'config-element',
      icon: 'pi-database',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'csv-data-set-config',
      label: 'CSV Data Set Config',
      description: 'Read test data from CSV',
      category: 'config-element',
      icon: 'pi-file',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'user-defined-variables',
      label: 'User Defined Variables',
      description: 'Define plan variables',
      category: 'config-element',
      icon: 'pi-dollar',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'counter',
      label: 'Counter',
      description: 'Generate incrementing values',
      category: 'config-element',
      icon: 'pi-sort-numeric-up',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'random-variable',
      label: 'Random Variable',
      description: 'Generate random values',
      category: 'config-element',
      icon: 'pi-question',
      color: '#64748b',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    // Listeners
    this.register({
      type: 'view-results-tree',
      label: 'View Results Tree',
      description: 'View detailed request/response',
      category: 'listener',
      icon: 'pi-sitemap',
      color: '#ef4444',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'summary-report',
      label: 'Summary Report',
      description: 'Summary statistics',
      category: 'listener',
      icon: 'pi-chart-bar',
      color: '#ef4444',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'aggregate-report',
      label: 'Aggregate Report',
      description: 'Aggregated statistics',
      category: 'listener',
      icon: 'pi-chart-pie',
      color: '#ef4444',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    this.register({
      type: 'backend-listener',
      label: 'Backend Listener',
      description: 'Send results to backend',
      category: 'listener',
      icon: 'pi-send',
      color: '#ef4444',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['root', 'thread-group'],
      defaultConfig: { ...baseConfig }
    });

    // AI Task
    this.register({
      type: 'ai-task',
      label: 'AI Task',
      description: 'AI-generated test step',
      category: 'ai',
      icon: 'pi-sparkles',
      color: '#ec4899',
      canHaveChildren: true,
      allowedChildren: ['response-assertion', 'json-extractor', 'regex-extractor'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        intent: '',
        language: 'groovy',
        inputVariables: [],
        outputVariables: [],
        contextHints: []
      }
    });

    // LM Studio AI
    this.register({
      type: 'lm-studio',
      label: 'LM Studio',
      description: 'Run prompts against local LM Studio models',
      category: 'ai',
      icon: 'pi-microchip-ai',
      color: '#10b981',
      canHaveChildren: true,
      allowedChildren: ['response-assertion', 'json-extractor', 'regex-extractor'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        endpoint: 'http://localhost:1234/v1/chat/completions',
        model: 'local-model',
        prompt: '',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        responseVariable: 'lm_response',
        inputVariables: [],
        parseJsonResponse: false
      }
    });

    // Poe AI
    this.register({
      type: 'poe-ai',
      label: 'Poe AI',
      description: 'Interact with Poe.com AI bots',
      category: 'ai',
      icon: 'pi-comment',
      color: '#8b5cf6',
      canHaveChildren: true,
      allowedChildren: ['response-assertion', 'json-extractor', 'regex-extractor'],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        botName: 'GPT-4',
        apiKey: '',
        prompt: '',
        systemPrompt: '',
        conversationId: '',
        responseVariable: 'poe_response',
        inputVariables: [],
        streamResponse: false
      }
    });

    // Docker Run
    this.register({
      type: 'docker-run',
      label: 'Docker Run',
      description: 'Run a Docker container',
      category: 'infrastructure',
      icon: 'pi-box',
      color: '#2563eb',
      canHaveChildren: true,
      allowedChildren: [
        'context-setup', 'http-request', 'jdbc-request', 'script',
        'response-assertion', 'json-assertion', 'duration-assertion',
        'json-extractor', 'regex-extractor', 'css-extractor',
        'constant-timer', 'beanshell-preprocessor', 'jsr223-preprocessor',
        'beanshell-postprocessor', 'jsr223-postprocessor', 'debug-postprocessor'
      ],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        imageName: '',
        imageTag: 'latest',
        registryUrl: '',
        registryUsername: '',
        registryPassword: '',
        command: '',
        args: [],
        environment: {},
        volumes: [],
        ports: [],
        network: 'bridge',
        cpuLimit: '1',
        memoryLimit: '512m',
        pullPolicy: 'ifNotPresent',
        removeAfterRun: true,
        waitForHealthy: true,
        healthCheckTimeout: 60000
      }
    });

    // Kubernetes Deploy
    this.register({
      type: 'k8s-deploy',
      label: 'K8s Deploy',
      description: 'Deploy to Kubernetes cluster',
      category: 'infrastructure',
      icon: 'pi-server',
      color: '#326ce5',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        kubeconfig: '',
        namespace: 'default',
        deploymentType: 'deployment',
        manifestYaml: '',
        imageName: '',
        imageTag: 'latest',
        replicas: 1,
        serviceAccount: 'default',
        environment: {},
        configMaps: [],
        secrets: [],
        resources: {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '512Mi' }
        },
        labels: {},
        annotations: {},
        waitForReady: true,
        readyTimeout: 300000,
        rollbackOnFailure: true
      }
    });

    // GitHub Release
    this.register({
      type: 'github-release',
      label: 'GitHub Release',
      description: 'Download assets from GitHub releases',
      category: 'infrastructure',
      icon: 'pi-github',
      color: '#333333',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: CONTROLLER_PARENTS,
      defaultConfig: {
        ...baseConfig,
        repository: '',
        releaseTag: 'latest',
        assetPattern: '*.tar.gz',
        downloadPath: '/tmp/releases',
        extractArchive: true,
        githubToken: '',
        preRelease: false,
        outputVariable: 'release_path'
      }
    });

    // Context Setup
    this.register({
      type: 'context-setup',
      label: 'Context Setup',
      description: 'Setup database connections and context variables',
      category: 'config-element',
      icon: 'pi-cog',
      color: '#0ea5e9',
      canHaveChildren: false,
      allowedChildren: [],
      allowedParents: ['thread-group', 'loop-controller', 'if-controller', 'while-controller', 'foreach-controller', 'transaction-controller', 'simple-controller', 'docker-run'],
      defaultConfig: {
        ...baseConfig,
        connections: [],
        variables: []
      }
    });
  }

  /**
   * Registers a node type in the registry.
   */
  private register(metadata: NodeTypeMetadata): void {
    this.registry.set(metadata.type, metadata);
  }

  // ============================================================
  // Public Query Methods
  // ============================================================

  /**
   * Gets metadata for a specific node type.
   * @param type - The node type to look up
   * @returns Metadata or undefined if not found
   */
  get(type: NodeType): NodeTypeMetadata | undefined {
    return this.registry.get(type);
  }

  /**
   * Gets all registered node types.
   * @returns Array of all node type metadata
   */
  getAll(): NodeTypeMetadata[] {
    return Array.from(this.registry.values());
  }

  /**
   * Gets all node types in a specific category.
   * @param category - The category to filter by
   * @returns Array of matching node types
   */
  getByCategory(category: NodeCategory): NodeTypeMetadata[] {
    return this.getAll().filter((m) => m.category === category);
  }

  /**
   * Gets all available categories in display order.
   * @returns Ordered array of category identifiers
   */
  getCategories(): NodeCategory[] {
    return [
      'test-plan',
      'thread-group',
      'sampler',
      'logic-controller',
      'config-element',
      'timer',
      'pre-processor',
      'post-processor',
      'assertion',
      'listener',
      'ai',
      'infrastructure'
    ];
  }

  /**
   * Gets the human-readable label for a category.
   * @param category - The category identifier
   * @returns Display label for the category
   */
  getCategoryLabel(category: NodeCategory): string {
    const labels: Record<NodeCategory, string> = {
      'test-plan': 'Test Plan',
      'thread-group': 'Thread Groups',
      'sampler': 'Samplers',
      'logic-controller': 'Logic Controllers',
      'config-element': 'Config Elements',
      'timer': 'Timers',
      'pre-processor': 'Pre-Processors',
      'post-processor': 'Post-Processors',
      'assertion': 'Assertions',
      'listener': 'Listeners',
      'ai': 'AI',
      'infrastructure': 'Infrastructure'
    };
    return labels[category];
  }

  /**
   * Gets node types that can be children of a given parent type.
   * Used for populating add-node menus and drag-drop validation.
   * @param parentType - The parent node type
   * @returns Array of allowed child node metadata
   */
  getAllowedChildren(parentType: NodeType): NodeTypeMetadata[] {
    const parent = this.get(parentType);
    if (!parent) return [];
    return parent.allowedChildren.map((type) => this.get(type)).filter((m): m is NodeTypeMetadata => !!m);
  }

  /**
   * Checks if a child node type can be added to a parent type.
   * Used for drag-drop and add-node validation.
   * @param parentType - The potential parent node type
   * @param childType - The potential child node type
   * @returns True if the child can be added to the parent
   */
  canAddChild(parentType: NodeType, childType: NodeType): boolean {
    const parent = this.get(parentType);
    return parent?.allowedChildren.includes(childType) ?? false;
  }

  /**
   * Gets the default configuration for a node type.
   * Used when creating new nodes.
   * @param type - The node type
   * @returns Default configuration object
   */
  getDefaultConfig(type: NodeType): Partial<NodeConfig> {
    return this.get(type)?.defaultConfig ?? { ...baseConfig };
  }
}
