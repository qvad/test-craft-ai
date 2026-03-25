import { FieldMetadata } from '../../core/services/ai/field-metadata.service';
import { Variable, TreeNode, NodeConfig } from '../models';

/**
 * Summary of a preceding node for AI context.
 */
export interface PrecedingNodeSummary {
  /** Node ID */
  id: string;
  /** Node type (e.g., 'docker-run', 'jdbc-request') */
  type: string;
  /** Node name */
  name: string;
  /** Key information extracted from the node config */
  keyInfo: string[];
  /** Variables this node produces/extracts */
  producedVariables: string[];
}

/**
 * System prompt for the AI Auto-Fill feature.
 * Instructs Claude on how to generate field values for test configuration.
 */
export const AUTO_FILL_SYSTEM_PROMPT = `You are TestCraftAI's configuration assistant, an expert in test automation. Your role is to help users configure test plan nodes by generating appropriate field values based on their natural language descriptions.

## Your Responsibilities:
1. Understand the user's testing intent from their description
2. Generate valid, realistic values for each configuration field
3. Use context variables appropriately with the \${variableName} syntax
4. Respect field constraints (data types, allowed values, required fields)
5. Provide confidence scores (0-1) and brief reasoning for each suggestion

## Response Format:
Return a valid JSON object with this exact structure:
{
  "suggestions": [
    {
      "fieldKey": "fieldName",
      "suggestedValue": "the value",
      "confidence": 0.95,
      "reasoning": "Brief explanation why this value was chosen",
      "variablesUsed": ["VAR1", "VAR2"]
    }
  ],
  "overallConfidence": 0.9,
  "warnings": ["Any warnings about the configuration"],
  "missingVariables": ["Variables referenced but not defined"]
}

## Critical Rules:
1. GENERATE A SUGGESTION FOR EVERY FIELD - do not skip any fields
2. Use ONLY the exact data types specified for each field
3. For enum fields, ONLY use values from allowedValues list
4. Reference ONLY variables from the provided list using \${variableName} syntax
5. Never invent variable names that don't exist
6. For JSON fields, return valid parseable JSON as a string
7. Consider security best practices (prefer HTTPS, don't hardcode secrets)
8. Provide higher confidence (0.8-1.0) for clear intents, lower (0.3-0.6) for fields using defaults
9. For boolean fields, return actual boolean true/false, not strings
10. If a field's value cannot be determined from intent, use its default value with lower confidence

## Testing Best Practices:
- For "invalid credentials" tests: use clearly wrong values, expect 401/403
- For "valid data" tests: use realistic but obviously test data (test@example.com)
- For API paths: follow RESTful conventions (/api/v1/resource)
- For timeouts: 30000ms for HTTP, 60000ms for database operations
- Use \${VARIABLE} syntax when a value should come from context

## Tree Context Awareness:
When "Preceding Nodes" context is provided, use it to understand the immediate structure:
- See what the parent node is doing (e.g., loop controller, transaction)
- See what sibling nodes executed right before this one

When "Available Context Variables" is provided, it contains values extracted/defined by ALL previous nodes:
- Use these variables with \${variableName} syntax for table names, container hosts, tokens, etc.
- These variables are the primary source for referencing previous node outputs`;

/**
 * Builds a user prompt for the AI Auto-Fill feature.
 *
 * @param nodeType - The type of node being configured
 * @param nodeTypeLabel - Human-readable label for the node type
 * @param intent - User's natural language description of what they want
 * @param fields - Available fields for this node type
 * @param variables - Available context variables
 * @param currentConfig - Current configuration values (if preserving)
 * @param preserveExisting - Whether to keep existing values
 * @param precedingNodes - Optional array of preceding nodes for tree context
 * @returns Formatted prompt string
 */
export function buildAutoFillUserPrompt(
  nodeType: string,
  nodeTypeLabel: string,
  intent: string,
  fields: FieldMetadata[],
  variables: Variable[],
  currentConfig: Record<string, unknown>,
  preserveExisting: boolean,
  precedingNodes?: PrecedingNodeSummary[]
): string {
  const parts: string[] = [];

  // Node type header
  parts.push(`## Node Type: ${nodeTypeLabel} (${nodeType})\n`);

  // User intent
  parts.push(`## User's Intent:\n"${intent}"\n`);

  // Available context variables
  if (variables.length > 0) {
    parts.push(`## Available Context Variables:`);
    variables.forEach((v) => {
      const valuePreview = v.sensitive ? '(hidden)' : formatVariableValue(v.value);
      parts.push(`- \${${v.name}} (${v.type}): ${v.description || 'No description'}${valuePreview ? ` - Current: ${valuePreview}` : ''}`);
    });
    parts.push('');
  } else {
    parts.push(`## Available Context Variables:\nNo context variables defined.\n`);
  }

  // Preceding nodes context (immediate structural context)
  if (precedingNodes && precedingNodes.length > 0) {
    parts.push(`## Immediate Preceding Nodes (parent + recent siblings):`);
    precedingNodes.forEach((node, index) => {
      parts.push(`${index + 1}. ${node.name} (${node.type})`);
      if (node.keyInfo.length > 0) {
        node.keyInfo.forEach(info => parts.push(`   - ${info}`));
      }
    });
    parts.push('');
  }

  // Fields to configure
  parts.push(`## Fields to Configure:`);
  fields.forEach((field) => {
    parts.push(`\n### ${field.key} (${field.label})`);
    parts.push(`- Type: ${field.dataType}`);
    parts.push(`- Required: ${field.required}`);

    if (field.allowedValues && field.allowedValues.length > 0) {
      parts.push(`- Allowed values: ${field.allowedValues.join(', ')}`);
    }

    if (field.defaultValue !== undefined) {
      parts.push(`- Default: ${JSON.stringify(field.defaultValue)}`);
    }

    if (field.example !== undefined) {
      parts.push(`- Example: ${JSON.stringify(field.example)}`);
    }

    if (field.semanticHints.length > 0) {
      parts.push(`- Hints: ${field.semanticHints.join('; ')}`);
    }

    if (field.supportsVariables) {
      parts.push(`- Supports variables: Yes (use \${variableName} syntax)`);
    }
  });
  parts.push('');

  // Current values
  if (preserveExisting && Object.keys(currentConfig).length > 0) {
    parts.push(`## Current Values (preserve if relevant):`);
    Object.entries(currentConfig).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`- ${key}: ${JSON.stringify(value)}`);
      }
    });
    parts.push('');
  }

  // Final instruction
  parts.push(`## Instructions:
Generate appropriate values for ALL fields listed above based on the user's intent.
Return a JSON object with the suggestions array as specified in your system prompt.
IMPORTANT: Include a suggestion for EVERY field - do not skip any fields.
For fields where the intent doesn't provide guidance, use sensible defaults with lower confidence (0.3-0.5).
${preserveExisting ? 'Since "preserve existing" is enabled, for fields with current values, suggest the existing value with high confidence unless the intent clearly requires a different value.' : ''}`);

  return parts.join('\n');
}

/**
 * Formats a variable value for display in the prompt.
 */
function formatVariableValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.length > 50 ? `${value.substring(0, 50)}...` : value;
  }

  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value);
      return str.length > 50 ? `${str.substring(0, 50)}...` : str;
    } catch {
      return '[object]';
    }
  }

  return String(value);
}

/**
 * Node type descriptions for better AI understanding.
 */
export const NODE_TYPE_DESCRIPTIONS: Record<string, string> = {
  'http-request': 'Makes HTTP/HTTPS requests to web APIs and services',
  'jdbc-request': 'Executes SQL queries against databases via JDBC',
  'script': 'Runs custom scripts in various languages (Groovy, JavaScript, etc.)',
  'ai-task': 'Uses AI to generate test logic from natural language',
  'thread-group': 'Controls concurrent execution with multiple virtual users',
  'constant-timer': 'Adds a fixed delay between requests',
  'response-assertion': 'Validates response data against expected values',
  'json-extractor': 'Extracts values from JSON responses using JSONPath',
  'docker-run': 'Runs Docker containers for infrastructure testing',
  'k8s-deploy': 'Deploys and manages Kubernetes resources',
  'lm-studio': 'Integrates with local LM Studio AI models',
  'poe-ai': 'Integrates with Poe.com AI bots',
  'github-release': 'Downloads assets from GitHub releases'
};

/**
 * Extracts key information from a node's config for AI context.
 * This summarizes what the node does/produces for preceding context.
 *
 * @param node - The tree node to extract info from
 * @returns Summary of the node for AI context
 */
export function extractNodeSummary(node: TreeNode): PrecedingNodeSummary {
  const config = node.config as unknown as Record<string, unknown>;
  const keyInfo: string[] = [];
  const producedVariables: string[] = [];

  switch (node.type) {
    // Database operations
    case 'jdbc-request': {
      const query = config['query'] as string;
      if (query) {
        // Extract table names from SQL
        const tableMatch = query.match(/(?:FROM|INTO|UPDATE|TABLE)\s+([`"']?\w+[`"']?)/gi);
        if (tableMatch) {
          const tables = tableMatch.map(m => m.replace(/^(FROM|INTO|UPDATE|TABLE)\s+/i, '').replace(/[`"']/g, ''));
          keyInfo.push(`SQL tables: ${tables.join(', ')}`);
        }
        // Show query type
        if (query.trim().toUpperCase().startsWith('CREATE')) {
          keyInfo.push('Creates database table/structure');
        } else if (query.trim().toUpperCase().startsWith('INSERT')) {
          keyInfo.push('Inserts data');
        } else if (query.trim().toUpperCase().startsWith('SELECT')) {
          keyInfo.push('Queries data');
        }
      }
      if (config['resultVariable']) {
        producedVariables.push(config['resultVariable'] as string);
      }
      if (config['connectionRef']) {
        keyInfo.push(`Connection: ${config['connectionRef']}`);
      }
      break;
    }

    // Docker containers
    case 'docker-run': {
      const imageName = config['imageName'] as string;
      const imageTag = config['imageTag'] as string;
      if (imageName) {
        keyInfo.push(`Docker image: ${imageName}${imageTag ? ':' + imageTag : ''}`);
      }
      const ports = config['ports'] as Array<{ hostPort: number; containerPort: number }>;
      if (ports && ports.length > 0) {
        keyInfo.push(`Exposed ports: ${ports.map(p => `${p.hostPort}:${p.containerPort}`).join(', ')}`);
      }
      const env = config['environment'] as Record<string, string>;
      if (env) {
        // Look for common database env vars
        if (env['POSTGRES_DB']) keyInfo.push(`PostgreSQL DB: ${env['POSTGRES_DB']}`);
        if (env['MYSQL_DATABASE']) keyInfo.push(`MySQL DB: ${env['MYSQL_DATABASE']}`);
        if (env['MONGO_INITDB_DATABASE']) keyInfo.push(`MongoDB DB: ${env['MONGO_INITDB_DATABASE']}`);
      }
      // Container produces host/port variables
      producedVariables.push('container_host', 'container_name');
      if (ports && ports.length > 0) {
        ports.forEach(p => producedVariables.push(`port_${p.containerPort}`));
      }
      break;
    }

    // HTTP requests
    case 'http-request': {
      const method = config['method'] as string;
      const path = config['path'] as string;
      const serverName = config['serverName'] as string;
      if (method && (path || serverName)) {
        keyInfo.push(`${method} ${serverName || ''}${path || ''}`);
      }
      break;
    }

    // Variable definitions
    case 'user-defined-variables': {
      const variables = config['variables'] as Record<string, string>;
      if (variables) {
        Object.keys(variables).forEach(v => producedVariables.push(v));
        keyInfo.push(`Defines variables: ${Object.keys(variables).join(', ')}`);
      }
      break;
    }

    // Extractors
    case 'json-extractor':
    case 'regex-extractor':
    case 'xpath-extractor':
    case 'boundary-extractor':
    case 'css-extractor': {
      const refName = config['refName'] as string || config['variableName'] as string;
      if (refName) {
        producedVariables.push(refName);
        keyInfo.push(`Extracts to variable: ${refName}`);
      }
      const expression = config['expression'] as string || config['jsonPath'] as string || config['regex'] as string;
      if (expression) {
        keyInfo.push(`Expression: ${expression.substring(0, 50)}${expression.length > 50 ? '...' : ''}`);
      }
      break;
    }

    // Random variable
    case 'random-variable': {
      const varName = config['variableName'] as string;
      if (varName) {
        producedVariables.push(varName);
        keyInfo.push(`Random variable: ${varName}`);
      }
      break;
    }

    // Counter
    case 'counter': {
      const varName = config['variableName'] as string;
      if (varName) {
        producedVariables.push(varName);
        keyInfo.push(`Counter variable: ${varName}`);
      }
      break;
    }

    // Connection configs
    case 'jdbc-connection-config': {
      const name = config['name'] as string;
      const dbType = config['type'] as string;
      const database = config['database'] as string;
      if (name) keyInfo.push(`Connection name: ${name}`);
      if (dbType) keyInfo.push(`Database type: ${dbType}`);
      if (database) keyInfo.push(`Database: ${database}`);
      break;
    }

    // Script nodes
    case 'script': {
      const language = config['language'] as string;
      if (language) keyInfo.push(`Script language: ${language}`);
      // Scripts can produce any variable, hard to know which
      break;
    }

    // AI task
    case 'ai-task': {
      const intent = config['intent'] as string;
      if (intent) keyInfo.push(`AI task: ${intent.substring(0, 50)}${intent.length > 50 ? '...' : ''}`);
      const outputVars = config['outputVariables'] as string[];
      if (outputVars) outputVars.forEach(v => producedVariables.push(v));
      break;
    }

    // Default: try to extract common variable patterns
    default: {
      // Look for common variable-producing fields
      ['resultVariable', 'outputVariable', 'variableName', 'refName', 'responseVariable'].forEach(field => {
        const value = config[field] as string;
        if (value) producedVariables.push(value);
      });
    }
  }

  return {
    id: node.id,
    type: node.type,
    name: node.name,
    keyInfo,
    producedVariables
  };
}

/**
 * Common testing scenarios and their typical configurations.
 * Used to help AI understand common patterns.
 */
export const COMMON_TEST_SCENARIOS = {
  'authentication-success': {
    description: 'Test successful login/authentication',
    hints: ['POST to auth endpoint', 'valid credentials', 'expect 200', 'extract token']
  },
  'authentication-failure': {
    description: 'Test authentication with invalid credentials',
    hints: ['POST to auth endpoint', 'invalid credentials', 'expect 401 or 403']
  },
  'crud-create': {
    description: 'Test creating a new resource',
    hints: ['POST method', 'valid payload', 'expect 201 Created', 'extract ID']
  },
  'crud-read': {
    description: 'Test reading/retrieving a resource',
    hints: ['GET method', 'path with ID', 'expect 200', 'validate response structure']
  },
  'crud-update': {
    description: 'Test updating an existing resource',
    hints: ['PUT or PATCH method', 'path with ID', 'updated payload', 'expect 200']
  },
  'crud-delete': {
    description: 'Test deleting a resource',
    hints: ['DELETE method', 'path with ID', 'expect 200 or 204']
  },
  'validation-error': {
    description: 'Test input validation error handling',
    hints: ['invalid or missing required fields', 'expect 400 Bad Request']
  },
  'not-found': {
    description: 'Test handling of non-existent resources',
    hints: ['invalid or non-existent ID', 'expect 404 Not Found']
  },
  'load-test': {
    description: 'Test performance under load',
    hints: ['multiple threads', 'loop count', 'think time delays']
  }
};
