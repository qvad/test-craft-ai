import { Injectable } from '@angular/core';
import { NodeType } from '../../../shared/models';

/**
 * Data types supported for field values.
 */
export type FieldDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'code'
  | 'array'
  | 'object';

/**
 * Metadata describing a configurable field for AI understanding.
 */
export interface FieldMetadata {
  /** Unique key matching the config property name */
  key: string;
  /** Human-readable label */
  label: string;
  /** Description of what this field does */
  description: string;
  /** Data type for validation and formatting */
  dataType: FieldDataType;
  /** Whether the field is required */
  required: boolean;
  /** For enum types, the allowed values */
  allowedValues?: string[];
  /** Example value to help AI understand expected format */
  example?: unknown;
  /** Whether ${variables} can be used in this field */
  supportsVariables: boolean;
  /** Semantic hints to help AI understand context */
  semanticHints: string[];
  /** Default value for the field */
  defaultValue?: unknown;
}

/**
 * Service providing field metadata definitions for all node types.
 * Used by AI Auto-Fill to understand what fields can be populated.
 *
 * @description
 * The FieldMetadataService provides comprehensive field definitions
 * for each node type, including data types, constraints, examples,
 * and semantic hints to help AI generate appropriate values.
 */
@Injectable({
  providedIn: 'root'
})
export class FieldMetadataService {
  private readonly fieldDefinitions: Map<NodeType, FieldMetadata[]> = new Map();

  constructor() {
    this.registerAllFieldDefinitions();
  }

  /**
   * Gets field metadata for a specific node type.
   * @param nodeType - The node type to get fields for
   * @returns Array of field metadata definitions
   */
  getFields(nodeType: NodeType): FieldMetadata[] {
    return this.fieldDefinitions.get(nodeType) || this.getBaseFields();
  }

  /**
   * Gets all field definitions for all node types.
   * @returns Map of node types to their field metadata
   */
  getAllFields(): Map<NodeType, FieldMetadata[]> {
    return this.fieldDefinitions;
  }

  /**
   * Gets base fields common to all node types.
   */
  private getBaseFields(): FieldMetadata[] {
    return [
      {
        key: 'description',
        label: 'Description',
        description: 'A description of what this node does',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['Describe the purpose and functionality'],
        example: 'Sends authentication request to login endpoint'
      },
      {
        key: 'timeout',
        label: 'Timeout (ms)',
        description: 'Maximum time to wait for completion in milliseconds',
        dataType: 'number',
        required: false,
        supportsVariables: true,
        semanticHints: ['Use reasonable defaults: 30000 for HTTP, 60000 for DB'],
        defaultValue: 30000,
        example: 30000
      },
      {
        key: 'retryCount',
        label: 'Retry Count',
        description: 'Number of times to retry on failure',
        dataType: 'number',
        required: false,
        supportsVariables: false,
        semanticHints: ['0 means no retries, typically 0-3'],
        defaultValue: 0,
        example: 2
      },
      {
        key: 'continueOnError',
        label: 'Continue on Error',
        description: 'Whether to continue execution if this node fails',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['Set true for non-critical operations'],
        defaultValue: false
      }
    ];
  }

  /**
   * Registers field definitions for all node types.
   */
  private registerAllFieldDefinitions(): void {
    // Thread Group
    this.fieldDefinitions.set('thread-group', [
      ...this.getBaseFields(),
      {
        key: 'numThreads',
        label: 'Number of Threads',
        description: 'Number of concurrent threads (virtual users)',
        dataType: 'number',
        required: true,
        supportsVariables: true,
        semanticHints: ['1 for single user, 10-100 for load testing'],
        defaultValue: 1,
        example: 10
      },
      {
        key: 'rampUp',
        label: 'Ramp-up Period (seconds)',
        description: 'Time to start all threads (gradual ramp-up)',
        dataType: 'number',
        required: true,
        supportsVariables: true,
        semanticHints: ['0 for instant start, numThreads for 1 thread/second'],
        defaultValue: 1,
        example: 10
      },
      {
        key: 'loops',
        label: 'Loop Count',
        description: 'Number of times each thread executes the test',
        dataType: 'number',
        required: true,
        supportsVariables: true,
        semanticHints: ['1 for single execution, -1 for infinite'],
        defaultValue: 1,
        example: 5
      },
      {
        key: 'delay',
        label: 'Start Delay (ms)',
        description: 'Initial delay before starting execution',
        dataType: 'number',
        required: false,
        supportsVariables: true,
        semanticHints: ['0 for immediate start'],
        defaultValue: 0,
        example: 1000
      }
    ]);

    // HTTP Request
    this.fieldDefinitions.set('http-request', [
      ...this.getBaseFields(),
      {
        key: 'method',
        label: 'HTTP Method',
        description: 'The HTTP method to use for the request',
        dataType: 'enum',
        required: true,
        allowedValues: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        supportsVariables: false,
        semanticHints: [
          'GET for retrieving data',
          'POST for creating/submitting data',
          'PUT for updating existing data',
          'DELETE for removing data',
          'PATCH for partial updates'
        ],
        defaultValue: 'GET',
        example: 'POST'
      },
      {
        key: 'protocol',
        label: 'Protocol',
        description: 'HTTP or HTTPS protocol',
        dataType: 'enum',
        required: true,
        allowedValues: ['http', 'https'],
        supportsVariables: false,
        semanticHints: ['Use https for production, http for local testing'],
        defaultValue: 'https',
        example: 'https'
      },
      {
        key: 'serverName',
        label: 'Server Name',
        description: 'The hostname or IP address of the server',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: [
          'Can use ${BASE_URL} or ${API_HOST} variable',
          'No protocol prefix (no http:// or https://)',
          'Example: api.example.com or localhost'
        ],
        example: '${API_HOST}'
      },
      {
        key: 'port',
        label: 'Port',
        description: 'Server port number',
        dataType: 'number',
        required: false,
        supportsVariables: true,
        semanticHints: ['80 for HTTP, 443 for HTTPS, leave empty for default'],
        example: 443
      },
      {
        key: 'path',
        label: 'Path',
        description: 'The URL path (endpoint)',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: [
          'Start with /',
          'Can include path parameters: /users/${userId}',
          'Example: /api/v1/auth/login'
        ],
        example: '/api/v1/users'
      },
      {
        key: 'bodyData',
        label: 'Request Body',
        description: 'The request body (JSON for API requests)',
        dataType: 'json',
        required: false,
        supportsVariables: true,
        semanticHints: [
          'Use valid JSON for API requests',
          'Include all required fields for the endpoint',
          'Can reference variables: {"token": "${AUTH_TOKEN}"}',
          'For invalid data tests, use malformed values'
        ],
        example: '{"email": "user@example.com", "password": "secret123"}'
      },
      {
        key: 'headers',
        label: 'Headers',
        description: 'HTTP headers to send with the request',
        dataType: 'object',
        required: false,
        supportsVariables: true,
        semanticHints: [
          'Content-Type: application/json for JSON bodies',
          'Authorization: Bearer ${TOKEN} for auth',
          'Include API keys, Accept headers as needed'
        ],
        example: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${AUTH_TOKEN}' }
      },
      {
        key: 'followRedirects',
        label: 'Follow Redirects',
        description: 'Whether to automatically follow HTTP redirects',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['Usually true, set false to test redirect behavior'],
        defaultValue: true
      },
      {
        key: 'useKeepalive',
        label: 'Use Keepalive',
        description: 'Use HTTP keep-alive connections',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True for better performance with multiple requests'],
        defaultValue: true
      }
    ]);

    // JDBC Request
    this.fieldDefinitions.set('jdbc-request', [
      ...this.getBaseFields(),
      {
        key: 'connectionRef',
        label: 'Connection Reference',
        description: 'Reference name of the JDBC connection configuration',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Must match a defined JDBC Connection Configuration name'],
        example: 'myDatabaseConnection'
      },
      {
        key: 'queryType',
        label: 'Query Type',
        description: 'Type of SQL query',
        dataType: 'enum',
        required: true,
        allowedValues: ['select', 'update', 'callable', 'prepared-select', 'prepared-update'],
        supportsVariables: false,
        semanticHints: [
          'select for SELECT queries',
          'update for INSERT/UPDATE/DELETE',
          'prepared-* for parameterized queries (safer)'
        ],
        defaultValue: 'select',
        example: 'select'
      },
      {
        key: 'query',
        label: 'SQL Query',
        description: 'The SQL query to execute',
        dataType: 'code',
        required: true,
        supportsVariables: true,
        semanticHints: [
          'Use ? for prepared statement parameters',
          'Can reference variables: SELECT * FROM users WHERE id = ${userId}',
          'Avoid SQL injection - use prepared statements'
        ],
        example: 'SELECT * FROM users WHERE status = ?'
      },
      {
        key: 'resultVariable',
        label: 'Result Variable',
        description: 'Variable name to store query results',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['Name without $ - results stored as ${variableName}'],
        example: 'queryResult'
      }
    ]);

    // Script
    this.fieldDefinitions.set('script', [
      ...this.getBaseFields(),
      {
        key: 'language',
        label: 'Language',
        description: 'Scripting language to use',
        dataType: 'enum',
        required: true,
        allowedValues: ['groovy', 'javascript', 'beanshell', 'java', 'kotlin', 'python'],
        supportsVariables: false,
        semanticHints: ['groovy is most common in JMeter, javascript for web-oriented'],
        defaultValue: 'groovy',
        example: 'groovy'
      },
      {
        key: 'script',
        label: 'Script',
        description: 'The script code to execute',
        dataType: 'code',
        required: true,
        supportsVariables: true,
        semanticHints: [
          'Access variables via vars.get("name") in Groovy',
          'Set variables via vars.put("name", "value")',
          'Include proper error handling',
          'Return value becomes script result'
        ],
        example: 'def result = vars.get("response")\nlog.info("Response: " + result)\nreturn result != null'
      }
    ]);

    // AI Task
    this.fieldDefinitions.set('ai-task', [
      ...this.getBaseFields(),
      {
        key: 'intent',
        label: 'Intent (Natural Language)',
        description: 'Natural language description of what the AI should do',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: [
          'Be specific and clear about the task',
          'Include context and expected output',
          'Reference input variables to process'
        ],
        example: 'Parse the API response and extract all user IDs into a list'
      },
      {
        key: 'language',
        label: 'Target Language',
        description: 'Programming language for generated code',
        dataType: 'enum',
        required: true,
        allowedValues: ['java', 'python', 'javascript', 'groovy', 'kotlin'],
        supportsVariables: false,
        semanticHints: ['Choose based on your test executor platform'],
        defaultValue: 'groovy',
        example: 'python'
      },
      {
        key: 'inputVariables',
        label: 'Input Variables',
        description: 'Variables this task will read',
        dataType: 'array',
        required: false,
        supportsVariables: false,
        semanticHints: ['List of variable names without ${} syntax'],
        example: ['response', 'userId', 'authToken']
      },
      {
        key: 'outputVariables',
        label: 'Output Variables',
        description: 'Variables this task will produce',
        dataType: 'array',
        required: false,
        supportsVariables: false,
        semanticHints: ['Names of variables to create/update'],
        example: ['parsedUsers', 'userCount']
      }
    ]);

    // Constant Timer
    this.fieldDefinitions.set('constant-timer', [
      ...this.getBaseFields(),
      {
        key: 'delay',
        label: 'Delay (ms)',
        description: 'Fixed delay duration in milliseconds',
        dataType: 'number',
        required: true,
        supportsVariables: true,
        semanticHints: ['1000 = 1 second, use for pacing requests'],
        defaultValue: 300,
        example: 1000
      }
    ]);

    // Response Assertion
    this.fieldDefinitions.set('response-assertion', [
      ...this.getBaseFields(),
      {
        key: 'testField',
        label: 'Test Field',
        description: 'Which part of the response to check',
        dataType: 'enum',
        required: true,
        allowedValues: ['response-data', 'response-code', 'response-message', 'response-headers', 'request-data', 'url'],
        supportsVariables: false,
        semanticHints: [
          'response-data for body content',
          'response-code for HTTP status (200, 401, etc.)',
          'response-headers for header values'
        ],
        defaultValue: 'response-data',
        example: 'response-code'
      },
      {
        key: 'testType',
        label: 'Test Type',
        description: 'How to compare the value',
        dataType: 'enum',
        required: true,
        allowedValues: ['contains', 'matches', 'equals', 'substring'],
        supportsVariables: false,
        semanticHints: [
          'contains for partial match',
          'equals for exact match',
          'matches for regex patterns'
        ],
        defaultValue: 'contains',
        example: 'equals'
      },
      {
        key: 'testStrings',
        label: 'Test Strings',
        description: 'Values to test against (one per line)',
        dataType: 'array',
        required: true,
        supportsVariables: true,
        semanticHints: [
          'For response-code, use status codes: 200, 401, 404',
          'For response-data, use expected content',
          'Multiple values are OR conditions'
        ],
        example: ['401']
      },
      {
        key: 'negation',
        label: 'Negate',
        description: 'Invert the assertion (test should NOT match)',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True to verify absence of something'],
        defaultValue: false
      }
    ]);

    // JSON Extractor
    this.fieldDefinitions.set('json-extractor', [
      ...this.getBaseFields(),
      {
        key: 'refName',
        label: 'Reference Name',
        description: 'Variable name to store extracted value',
        dataType: 'string',
        required: true,
        supportsVariables: false,
        semanticHints: ['Name without $ - access via ${refName}'],
        example: 'userId'
      },
      {
        key: 'expression',
        label: 'JSONPath Expression',
        description: 'JSONPath to extract value from response',
        dataType: 'string',
        required: true,
        supportsVariables: false,
        semanticHints: [
          '$ is root, $.data.id for nested',
          '$..id for recursive search',
          '$.items[*].name for arrays'
        ],
        example: '$.data.user.id'
      },
      {
        key: 'matchNumber',
        label: 'Match Number',
        description: 'Which match to use (0=random, -1=all, n=nth)',
        dataType: 'number',
        required: false,
        supportsVariables: false,
        semanticHints: ['1 for first match, -1 for all as array'],
        defaultValue: 1,
        example: 1
      },
      {
        key: 'defaultValue',
        label: 'Default Value',
        description: 'Value if no match found',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Fallback value for missing data'],
        example: 'NOT_FOUND'
      }
    ]);

    // Docker Run
    this.fieldDefinitions.set('docker-run', [
      ...this.getBaseFields(),
      {
        key: 'imageName',
        label: 'Image Name',
        description: 'Docker image name',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Example: nginx, postgres, your-app'],
        example: 'nginx'
      },
      {
        key: 'imageTag',
        label: 'Image Tag',
        description: 'Docker image tag/version',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['latest, specific version like 1.21.0, or ${VERSION}'],
        defaultValue: 'latest',
        example: 'latest'
      },
      {
        key: 'registryUrl',
        label: 'Registry URL',
        description: 'Docker registry URL',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Leave empty for Docker Hub, or gcr.io, ecr.aws'],
        example: 'docker.io'
      },
      {
        key: 'command',
        label: 'Command',
        description: 'Command to run in container',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Override container default CMD'],
        example: '/bin/sh -c "echo hello"'
      },
      {
        key: 'environment',
        label: 'Environment Variables',
        description: 'Environment variables as JSON object',
        dataType: 'object',
        required: false,
        supportsVariables: true,
        semanticHints: ['{"KEY": "value", "DB_HOST": "${DATABASE_HOST}"}'],
        example: { NODE_ENV: 'test', API_URL: '${API_HOST}' }
      },
      {
        key: 'cpuLimit',
        label: 'CPU Limit',
        description: 'CPU cores limit',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['1.0 = 1 core, 0.5 = half core'],
        example: '1.0'
      },
      {
        key: 'memoryLimit',
        label: 'Memory Limit',
        description: 'Memory limit with unit',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['512m, 1g, 2g'],
        example: '512m'
      },
      {
        key: 'pullPolicy',
        label: 'Pull Policy',
        description: 'When to pull the image',
        dataType: 'enum',
        required: false,
        allowedValues: ['always', 'ifNotPresent', 'never'],
        supportsVariables: false,
        semanticHints: ['ifNotPresent for caching, always for latest'],
        defaultValue: 'ifNotPresent'
      },
      {
        key: 'removeAfterRun',
        label: 'Remove After Run',
        description: 'Delete container after execution',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True for cleanup, false for debugging'],
        defaultValue: true
      },
      {
        key: 'waitForHealthy',
        label: 'Wait for Healthy',
        description: 'Wait for container health check to pass',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True if container has health check'],
        defaultValue: false
      }
    ]);

    // K8s Deploy
    this.fieldDefinitions.set('k8s-deploy', [
      ...this.getBaseFields(),
      {
        key: 'namespace',
        label: 'Namespace',
        description: 'Kubernetes namespace',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['default, or specific namespace like staging, production'],
        defaultValue: 'default',
        example: 'default'
      },
      {
        key: 'deploymentType',
        label: 'Deployment Type',
        description: 'Kubernetes workload type',
        dataType: 'enum',
        required: true,
        allowedValues: ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'],
        supportsVariables: false,
        semanticHints: [
          'deployment for stateless apps',
          'statefulset for databases',
          'job for one-time tasks'
        ],
        defaultValue: 'deployment',
        example: 'deployment'
      },
      {
        key: 'imageName',
        label: 'Image Name',
        description: 'Container image name',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Full image path: registry/image or just image'],
        example: 'myapp'
      },
      {
        key: 'imageTag',
        label: 'Image Tag',
        description: 'Container image tag',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Version tag or ${BUILD_TAG}'],
        defaultValue: 'latest',
        example: '${VERSION}'
      },
      {
        key: 'replicas',
        label: 'Replicas',
        description: 'Number of pod replicas',
        dataType: 'number',
        required: false,
        supportsVariables: true,
        semanticHints: ['1 for single instance, 3+ for HA'],
        defaultValue: 1,
        example: 3
      },
      {
        key: 'manifestYaml',
        label: 'Manifest YAML',
        description: 'Full Kubernetes manifest YAML',
        dataType: 'code',
        required: false,
        supportsVariables: true,
        semanticHints: ['Complete K8s manifest, overrides other fields if provided'],
        example: 'apiVersion: apps/v1\nkind: Deployment\n...'
      },
      {
        key: 'waitForReady',
        label: 'Wait for Ready',
        description: 'Wait for pods to be ready',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True to ensure deployment success'],
        defaultValue: true
      },
      {
        key: 'rollbackOnFailure',
        label: 'Rollback on Failure',
        description: 'Automatically rollback if deployment fails',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True for safer deployments'],
        defaultValue: true
      }
    ]);

    // LM Studio
    this.fieldDefinitions.set('lm-studio', [
      ...this.getBaseFields(),
      {
        key: 'endpoint',
        label: 'Endpoint',
        description: 'LM Studio API endpoint URL',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Usually http://localhost:1234/v1/chat/completions'],
        defaultValue: 'http://localhost:1234/v1/chat/completions',
        example: 'http://localhost:1234/v1/chat/completions'
      },
      {
        key: 'model',
        label: 'Model',
        description: 'Model name to use',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Model loaded in LM Studio'],
        example: 'local-model'
      },
      {
        key: 'prompt',
        label: 'Prompt',
        description: 'The prompt to send to the model',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Can include ${variables} for dynamic content'],
        example: 'Analyze the following data: ${responseData}'
      },
      {
        key: 'systemPrompt',
        label: 'System Prompt',
        description: 'System instructions for the model',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Sets context and behavior for the AI'],
        example: 'You are a helpful assistant that analyzes API responses.'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        description: 'Response randomness (0-2)',
        dataType: 'number',
        required: false,
        supportsVariables: false,
        semanticHints: ['0 for deterministic, 0.7 for creative, 2 for very random'],
        defaultValue: 0.7,
        example: 0.7
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        description: 'Maximum response length in tokens',
        dataType: 'number',
        required: false,
        supportsVariables: false,
        semanticHints: ['512-4096 typical, depends on model'],
        defaultValue: 1024,
        example: 2048
      },
      {
        key: 'responseVariable',
        label: 'Response Variable',
        description: 'Variable to store the AI response',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['Name without $ - access via ${variableName}'],
        example: 'aiResponse'
      }
    ]);

    // Poe AI
    this.fieldDefinitions.set('poe-ai', [
      ...this.getBaseFields(),
      {
        key: 'botName',
        label: 'Bot Name',
        description: 'Poe bot to use',
        dataType: 'enum',
        required: true,
        allowedValues: ['Claude-3.5-Sonnet', 'Claude-3-Opus', 'GPT-4o', 'GPT-4-Turbo', 'Gemini-Pro', 'Llama-3.1-405B', 'Llama-3.1-70B', 'Mixtral-8x22B'],
        supportsVariables: false,
        semanticHints: ['Choose based on capability needed'],
        defaultValue: 'Claude-3.5-Sonnet',
        example: 'Claude-3.5-Sonnet'
      },
      {
        key: 'apiKey',
        label: 'API Key',
        description: 'Poe API key',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Use ${POE_API_KEY} variable for security'],
        example: '${POE_API_KEY}'
      },
      {
        key: 'prompt',
        label: 'Prompt',
        description: 'The prompt to send',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Can include ${variables}'],
        example: 'Analyze this response: ${apiResponse}'
      },
      {
        key: 'systemPrompt',
        label: 'System Prompt',
        description: 'System instructions',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Optional context setting'],
        example: 'You are analyzing test results.'
      },
      {
        key: 'responseVariable',
        label: 'Response Variable',
        description: 'Variable to store response',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['Name without $'],
        example: 'poeResponse'
      },
      {
        key: 'streamResponse',
        label: 'Stream Response',
        description: 'Whether to stream the response',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True for real-time output'],
        defaultValue: false
      }
    ]);

    // GitHub Release
    this.fieldDefinitions.set('github-release', [
      ...this.getBaseFields(),
      {
        key: 'repository',
        label: 'Repository',
        description: 'GitHub repository (owner/repo)',
        dataType: 'string',
        required: true,
        supportsVariables: true,
        semanticHints: ['Format: owner/repository'],
        example: 'apache/jmeter'
      },
      {
        key: 'releaseTag',
        label: 'Release Tag',
        description: 'Release tag to download',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['v1.0.0, latest, or ${VERSION}'],
        defaultValue: 'latest',
        example: 'latest'
      },
      {
        key: 'assetPattern',
        label: 'Asset Pattern',
        description: 'Pattern to match release assets',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Glob pattern: *.tar.gz, *-linux-amd64.zip'],
        example: '*.tar.gz'
      },
      {
        key: 'githubToken',
        label: 'GitHub Token',
        description: 'GitHub personal access token',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Use ${GITHUB_TOKEN} variable, needed for private repos'],
        example: '${GITHUB_TOKEN}'
      },
      {
        key: 'downloadPath',
        label: 'Download Path',
        description: 'Local path to download to',
        dataType: 'string',
        required: false,
        supportsVariables: true,
        semanticHints: ['Directory path, file will be named automatically'],
        example: '/tmp/downloads'
      },
      {
        key: 'extractArchive',
        label: 'Extract Archive',
        description: 'Automatically extract downloaded archives',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True for .zip, .tar.gz files'],
        defaultValue: true
      },
      {
        key: 'preRelease',
        label: 'Include Pre-releases',
        description: 'Include pre-release versions',
        dataType: 'boolean',
        required: false,
        supportsVariables: false,
        semanticHints: ['True to include beta/rc versions'],
        defaultValue: false
      },
      {
        key: 'outputVariable',
        label: 'Output Variable',
        description: 'Variable to store downloaded file path',
        dataType: 'string',
        required: false,
        supportsVariables: false,
        semanticHints: ['Name without $'],
        example: 'downloadedPath'
      }
    ]);

    // Register remaining node types with base fields
    const simpleNodes: NodeType[] = [
      'root',
      'assertion',
      'extractor',
      'loop-controller',
      'if-controller',
      'while-controller',
      'foreach-controller',
      'transaction-controller',
      'simple-controller',
      'module-controller',
      'include-controller',
      'uniform-random-timer',
      'gaussian-random-timer',
      'config-element',
      'csv-data-set-config',
      'http-header-manager',
      'http-cookie-manager',
      'listener',
      'view-results-tree',
      'summary-report',
      'aggregate-report',
      'pre-processor',
      'post-processor'
    ];

    simpleNodes.forEach(nodeType => {
      if (!this.fieldDefinitions.has(nodeType)) {
        this.fieldDefinitions.set(nodeType, this.getBaseFields());
      }
    });
  }
}
