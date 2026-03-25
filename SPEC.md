# TestCraft AI - Visual Test Orchestration Platform

## Project Specification v1.1

---

## 1. Executive Summary

**TestCraft AI** is a visual test orchestration platform that allows users to design, configure, and execute test plans through a tree-based interface (similar to JMeter). The platform leverages AI to generate executable code from natural language descriptions while ensuring code validity through a multi-layer validation system.

### Core Principles
- **No-Code Surface**: Users describe what they want, not how to implement it
- **AI-Powered Auto-Fill**: Natural language descriptions automatically populate configuration fields
- **Code Transparency**: Generated code is always accessible for inspection
- **Validated Execution**: AI-generated code must pass validation before execution
- **Containerized Isolation**: Each step runs in isolated Docker containers
- **Language Agnostic**: Support for multiple programming languages per step
- **Multi-Provider AI**: Support for LM Studio (default), Anthropic Claude, OpenAI, and Ollama

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Angular 19/TypeScript)                │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  Tree View  │  │  Node Config     │  │  Execution Monitor          │ │
│  │  Component  │  │  Panel           │  │  Component                  │ │
│  └─────────────┘  └──────────────────┘  └─────────────────────────────┘ │
│                   ┌──────────────────┐                                   │
│                   │  AI Auto-Fill    │                                   │
│                   │  Dialog          │                                   │
│                   └──────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ REST/WebSocket
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Node.js/TypeScript)                    │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  Test Plan  │  │  Code Generation │  │  Execution                  │ │
│  │  Service    │  │  Service         │  │  Service                    │ │
│  └─────────────┘  └──────────────────┘  └─────────────────────────────┘ │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  Validation │  │  AI Integration  │  │  Container                  │ │
│  │  Service    │  │  Service         │  │  Orchestrator               │ │
│  └─────────────┘  └──────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  PostgreSQL │ │    Redis    │ │  Docker/K8s │
            │  Database   │ │    Cache    │ │  Runtime    │
            └─────────────┘ └─────────────┘ └─────────────┘
```

### 2.2 Component Breakdown

| Component | Responsibility |
|-----------|---------------|
| Tree View | Display and manage test plan hierarchy |
| Step Editor | Configure individual step parameters |
| Execution Monitor | Real-time execution feedback and logs |
| Test Plan Service | CRUD operations for test plans |
| Code Generation Service | AI-powered code generation |
| Validation Service | Multi-layer code validation |
| AI Integration Service | Communication with AI providers |
| Execution Service | Manage test execution lifecycle |
| Container Orchestrator | Docker/K8s pod management |

---

## 3. Data Models

### 3.1 Core Entities

#### TestPlan
```typescript
interface TestPlan {
  id: string;                    // UUID
  name: string;                  // User-defined name
  description: string;           // Optional description
  rootNodeId: string;            // Reference to root node
  variables: Variable[];         // Plan-level variables
  environments: Environment[];   // Environment configurations
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;            // User ID
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed';
}
```

#### TreeNode
```typescript
interface TreeNode {
  id: string;                    // UUID
  testPlanId: string;            // Parent test plan
  parentId: string | null;       // Parent node (null for root)
  type: NodeType;                // Type of node
  name: string;                  // Display name
  order: number;                 // Sibling order
  enabled: boolean;              // Can be disabled without deletion
  config: NodeConfig;            // Type-specific configuration
  generatedCode: GeneratedCode | null;  // AI-generated code
  validationStatus: ValidationStatus;
  children: string[];            // Child node IDs
}

type NodeType = 
  | 'root'           // Test plan root
  | 'group'          // Logical grouping (like Thread Group)
  | 'jdbc'           // Database operations
  | 'http'           // HTTP requests
  | 'script'         // Custom script execution
  | 'assertion'      // Validation/assertion
  | 'extractor'      // Data extraction
  | 'loop'           // Loop controller
  | 'condition'      // Conditional execution
  | 'delay'          // Wait/delay
  | 'ai-task';       // Generic AI-described task
```

#### NodeConfig (Type-Specific)
```typescript
// Base configuration all nodes share
interface BaseNodeConfig {
  description: string;           // Natural language description
  timeout: number;               // Execution timeout in ms
  retryCount: number;            // Number of retries on failure
  continueOnError: boolean;      // Continue execution on error
}

// JDBC Step Configuration
interface JdbcNodeConfig extends BaseNodeConfig {
  type: 'jdbc';
  connectionRef: string;         // Reference to connection variable
  operation: 'query' | 'update' | 'procedure' | 'batch';
  intent: string;                // Natural language: "Get all active users"
  
  // Optional explicit SQL (if user wants to override AI)
  explicitSql?: string;
  
  // Query parameters
  parameters: QueryParameter[];
  
  // Result handling
  resultVariable?: string;       // Store result in variable
  resultMapping?: ResultMapping; // How to map results
  
  // Validation hints for AI
  expectedSchema?: {
    tables: string[];
    columns: string[];
  };
}

// HTTP Step Configuration
interface HttpNodeConfig extends BaseNodeConfig {
  type: 'http';
  baseUrlRef: string;            // Reference to base URL variable
  intent: string;                // "Create a new user with provided data"
  
  // Optional explicit configuration
  explicit?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    headers: Record<string, string>;
    body?: any;
  };
  
  // Request parameters
  pathParams: Parameter[];
  queryParams: Parameter[];
  bodyTemplate?: string;
  
  // Response handling
  responseVariable?: string;
  expectedStatusCodes: number[];
}

// Script Step Configuration
interface ScriptNodeConfig extends BaseNodeConfig {
  type: 'script';
  language: 'java' | 'python' | 'javascript' | 'groovy' | 'kotlin';
  intent: string;                // What the script should do
  
  // Optional explicit code
  explicitCode?: string;
  
  // Input/Output contract
  inputs: ScriptVariable[];
  outputs: ScriptVariable[];
  
  // Dependencies
  dependencies: string[];        // e.g., ["com.google.guava:guava:31.0"]
}

// AI Task Configuration (generic)
interface AiTaskNodeConfig extends BaseNodeConfig {
  type: 'ai-task';
  intent: string;                // Full natural language description
  language: 'java' | 'python' | 'javascript' | 'groovy' | 'kotlin';
  
  // Context hints
  contextHints: {
    inputVariables: string[];    // Variables this task will use
    outputVariables: string[];   // Variables this task will produce
    sideEffects: string[];       // e.g., ["writes to file", "sends email"]
  };
}

// Assertion Configuration
interface AssertionNodeConfig extends BaseNodeConfig {
  type: 'assertion';
  intent: string;                // "Response status should be 200"
  
  // Or explicit assertion
  explicit?: {
    type: 'equals' | 'contains' | 'regex' | 'jsonpath' | 'xpath' | 'custom';
    expected: any;
    actual: string;              // Variable reference or expression
  };
}
```

#### GeneratedCode
```typescript
interface GeneratedCode {
  id: string;
  nodeId: string;
  language: string;
  code: string;                  // The actual generated code
  entryPoint: string;            // Main class/function name
  dependencies: Dependency[];    // Required dependencies
  
  // AI generation metadata
  generatedAt: Date;
  generatedBy: string;           // AI model identifier
  promptUsed: string;            // The prompt sent to AI
  confidence: number;            // AI's confidence score (0-1)
  
  // Validation results
  validationResults: ValidationResult[];
  isValid: boolean;
  
  // Test code
  testCode?: string;             // Generated unit tests
  testResults?: TestResult[];
}

interface Dependency {
  name: string;                  // e.g., "mysql-connector-java"
  version: string;               // e.g., "8.0.28"
  repository?: string;           // Maven central, npm, pypi, etc.
}
```

#### ValidationResult
```typescript
interface ValidationResult {
  validatorId: string;
  validatorName: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: any;
  timestamp: Date;
}

type ValidationStatus = 
  | 'pending'          // Not yet validated
  | 'validating'       // Validation in progress
  | 'valid'            // All validations passed
  | 'invalid'          // Validation failed
  | 'warning';         // Passed with warnings
```

#### Variable
```typescript
interface Variable {
  id: string;
  name: string;                  // Variable name (e.g., "db.connection")
  type: VariableType;
  scope: 'plan' | 'environment' | 'runtime';
  value: any;                    // Default value
  sensitive: boolean;            // Is this a secret?
  description: string;
}

type VariableType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'connection'       // Database connection
  | 'credentials'      // Username/password pair
  | 'list'
  | 'map';
```

#### Execution Models
```typescript
interface TestExecution {
  id: string;
  testPlanId: string;
  environmentId: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  triggeredBy: string;           // User ID or 'scheduler'
  results: NodeExecutionResult[];
  logs: ExecutionLog[];
}

type ExecutionStatus = 
  | 'queued'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface NodeExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;             // ms
  output?: any;                  // Step output
  error?: ExecutionError;
  logs: string[];
  metrics: ExecutionMetrics;
}

interface ExecutionMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkIO: number;
  customMetrics: Record<string, number>;
}
```

---

## 4. AI Code Generation System

### 4.1 Generation Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │   Context    │     │     AI       │     │  Generated   │
│   Intent     │────▶│   Builder    │────▶│   Request    │────▶│    Code      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                     ┌──────────────┐     ┌──────────────┐            │
                     │   Stored     │◀────│  Validation  │◀───────────┘
                     │   Code       │     │   Pipeline   │
                     └──────────────┘     └──────────────┘
```

### 4.2 Context Builder

The Context Builder assembles all relevant information for AI code generation:

```typescript
interface GenerationContext {
  // The specific step being generated
  step: {
    type: NodeType;
    config: NodeConfig;
    intent: string;
  };
  
  // Available variables and their types
  availableVariables: Variable[];
  
  // Previous steps' outputs (for data flow understanding)
  previousStepOutputs: {
    nodeId: string;
    nodeName: string;
    outputSchema: any;
  }[];
  
  // Environment information
  environment: {
    targetLanguage: string;
    runtimeVersion: string;
    availableLibraries: string[];
  };
  
  // Schema information (for JDBC)
  databaseSchema?: {
    tables: TableSchema[];
    procedures: ProcedureSchema[];
  };
  
  // API specs (for HTTP)
  apiSpecification?: {
    openApiSpec?: any;
    endpoints: EndpointInfo[];
  };
  
  // Project conventions
  conventions: {
    namingConvention: string;
    errorHandling: string;
    loggingPattern: string;
  };
}
```

### 4.3 AI Prompt Templates

#### JDBC Step Prompt Template
```typescript
const jdbcPromptTemplate = `
You are generating production-ready {{language}} code for a JDBC database operation.

## Task Description
{{intent}}

## Database Context
- Connection variable: {{connectionRef}}
- Available tables: {{tables}}
- Table schemas:
{{#each tableSchemas}}
  - {{name}}: {{columns}}
{{/each}}

## Requirements
1. Generate a complete, executable class/function
2. Use parameterized queries to prevent SQL injection
3. Handle connection management properly (use try-with-resources)
4. Include proper error handling
5. Log all operations
6. Return results in a structured format

## Input Variables Available
{{#each inputVariables}}
- {{name}} ({{type}}): {{description}}
{{/each}}

## Expected Output
- Variable name: {{outputVariable}}
- Format: {{outputFormat}}

## Code Conventions
- Package: com.testcraft.generated
- Class naming: PascalCase
- Method naming: camelCase
- Always include JavaDoc comments

Generate ONLY the code, no explanations. The code must be complete and compilable.
`;
```

### 4.4 AI Response Contract

```typescript
interface AIGenerationResponse {
  // The generated code
  code: string;
  
  // Entry point information
  entryPoint: {
    className: string;
    methodName: string;
    signature: string;
  };
  
  // Dependencies required
  dependencies: {
    name: string;
    version: string;
    scope: 'compile' | 'runtime' | 'test';
  }[];
  
  // Self-declared contracts
  contracts: {
    inputs: {
      name: string;
      type: string;
      required: boolean;
    }[];
    outputs: {
      name: string;
      type: string;
    }[];
    sideEffects: string[];
    exceptions: string[];
  };
  
  // Test suggestions
  suggestedTests: {
    name: string;
    description: string;
    testCode: string;
  }[];
  
  // AI confidence and reasoning
  confidence: number;
  reasoning: string;
  alternatives?: string[];     // Alternative approaches considered
}
```

---

## 5. Validation System

### 5.1 Validation Pipeline

```
Generated Code
      │
      ▼
┌─────────────────┐
│ 1. Syntax       │ ──▶ Parse AST, check for syntax errors
│    Validation   │
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│ 2. Semantic     │ ──▶ Verify imports, types, dependencies exist
│    Validation   │
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│ 3. Contract     │ ──▶ Verify code matches declared contracts
│    Validation   │
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│ 4. Schema       │ ──▶ Verify DB tables/columns, API endpoints exist
│    Validation   │
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│ 5. Security     │ ──▶ Check for injection, unsafe patterns
│    Validation   │
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│ 6. Dry Run      │ ──▶ Compile and run with mock data
│    Validation   │
└────────┬────────┘
         │ ✓
         ▼
    VALIDATED
```

### 5.2 Validator Implementations

```typescript
interface Validator {
  id: string;
  name: string;
  description: string;
  applicableTo: NodeType[];      // Which node types this validates
  priority: number;              // Execution order
  
  validate(context: ValidationContext): Promise<ValidationResult>;
}

interface ValidationContext {
  node: TreeNode;
  generatedCode: GeneratedCode;
  testPlan: TestPlan;
  environment: Environment;
  
  // Runtime helpers
  databaseConnection?: DatabaseConnection;
  httpClient?: HttpClient;
}

// Example validators
const validators: Validator[] = [
  {
    id: 'syntax-java',
    name: 'Java Syntax Validator',
    description: 'Validates Java code syntax using Eclipse JDT',
    applicableTo: ['jdbc', 'http', 'script', 'ai-task'],
    priority: 1,
    async validate(ctx) {
      // Use Java parser to check syntax
    }
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection Validator',
    description: 'Checks for SQL injection vulnerabilities',
    applicableTo: ['jdbc'],
    priority: 3,
    async validate(ctx) {
      // Check for string concatenation in SQL
      // Verify parameterized queries
    }
  },
  {
    id: 'schema-match',
    name: 'Database Schema Validator',
    description: 'Verifies tables and columns exist',
    applicableTo: ['jdbc'],
    priority: 4,
    async validate(ctx) {
      // Parse SQL from code
      // Extract table/column references
      // Verify against actual schema
    }
  },
  {
    id: 'dry-run',
    name: 'Dry Run Validator',
    description: 'Compiles and runs code with mock data',
    applicableTo: ['jdbc', 'http', 'script', 'ai-task'],
    priority: 10,
    async validate(ctx) {
      // Compile code
      // Run with mock inputs
      // Verify output structure
    }
  }
];
```

### 5.3 Anti-Hallucination Checks

```typescript
interface HallucinationDetector {
  // Check if code references non-existent entities
  async detectHallucinations(
    code: string,
    context: GenerationContext
  ): Promise<HallucinationReport>;
}

interface HallucinationReport {
  hasHallucinations: boolean;
  issues: HallucinationIssue[];
}

interface HallucinationIssue {
  type: 
    | 'non-existent-table'
    | 'non-existent-column'
    | 'non-existent-api-endpoint'
    | 'non-existent-library'
    | 'non-existent-method'
    | 'invented-syntax';
  location: {
    line: number;
    column: number;
  };
  reference: string;           // What was referenced
  suggestion?: string;         // Did you mean...?
}
```

---

## 6. Execution Engine

### 6.1 Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Execution Service                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Execution Queue                         ││
│  │  [Plan A: Step 2] [Plan B: Step 1] [Plan A: Step 3]     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Container Orchestrator                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Pod Manager  │  │ Image Builder │  │ Resource Mgr  │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Java Pod    │     │  Python Pod   │     │   Node Pod    │
│  ┌─────────┐  │     │  ┌─────────┐  │     │  ┌─────────┐  │
│  │ JDK 17  │  │     │  │Python311│  │     │  │ Node 20 │  │
│  │ Maven   │  │     │  │ pip     │  │     │  │ npm     │  │
│  │ Gradle  │  │     │  │ venv    │  │     │  │ yarn    │  │
│  └─────────┘  │     │  └─────────┘  │     │  └─────────┘  │
│  + User deps  │     │  + User deps  │     │  + User deps  │
└───────────────┘     └───────────────┘     └───────────────┘
```

### 6.2 Docker Image Strategy

```typescript
interface DockerImageConfig {
  // Base images per language
  baseImages: {
    java: 'testcraft/java-runner:17';
    python: 'testcraft/python-runner:3.11';
    javascript: 'testcraft/node-runner:20';
    groovy: 'testcraft/groovy-runner:4';
    kotlin: 'testcraft/kotlin-runner:1.9';
  };
  
  // Pre-installed in base images
  preInstalled: {
    java: [
      'mysql-connector-java',
      'postgresql',
      'httpclient',
      'jackson-databind',
      'slf4j-api',
      'junit-jupiter'
    ];
    // ... etc
  };
}

// Dynamic image building for custom dependencies
interface ImageBuilder {
  async buildImage(
    baseImage: string,
    additionalDependencies: Dependency[],
    customization?: ImageCustomization
  ): Promise<string>; // Returns image tag
}
```

### 6.3 Execution Flow

```typescript
interface ExecutionEngine {
  async executeTestPlan(
    testPlanId: string,
    environmentId: string,
    options: ExecutionOptions
  ): Promise<TestExecution>;
  
  async executeNode(
    nodeId: string,
    context: ExecutionContext
  ): Promise<NodeExecutionResult>;
}

interface ExecutionOptions {
  mode: 'sequential' | 'parallel';
  stopOnFailure: boolean;
  timeout: number;
  debugMode: boolean;
  dryRun: boolean;
}

interface ExecutionContext {
  executionId: string;
  variables: Map<string, any>;
  previousResults: NodeExecutionResult[];
  environment: Environment;
  logger: ExecutionLogger;
}

// Execution flow for a single node
async function executeNode(
  node: TreeNode,
  context: ExecutionContext
): Promise<NodeExecutionResult> {
  const startTime = Date.now();
  
  try {
    // 1. Validate code is ready
    if (!node.generatedCode?.isValid) {
      throw new Error('Code not validated');
    }
    
    // 2. Resolve dependencies and prepare image
    const imageTag = await prepareExecutionImage(
      node.generatedCode.language,
      node.generatedCode.dependencies
    );
    
    // 3. Prepare execution payload
    const payload = {
      code: node.generatedCode.code,
      entryPoint: node.generatedCode.entryPoint,
      inputs: resolveInputs(node.config, context.variables),
      timeout: node.config.timeout
    };
    
    // 4. Start container and execute
    const container = await startContainer(imageTag, payload);
    const result = await waitForCompletion(container, node.config.timeout);
    
    // 5. Extract outputs and update context
    if (result.outputs) {
      updateVariables(context.variables, result.outputs);
    }
    
    return {
      nodeId: node.id,
      status: 'passed',
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      output: result.outputs,
      logs: result.logs,
      metrics: result.metrics
    };
    
  } catch (error) {
    return {
      nodeId: node.id,
      status: 'failed',
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      },
      logs: []
    };
  }
}
```

---

## 7. API Specification

### 7.1 REST API Endpoints

#### Test Plans
```
GET    /api/v1/test-plans                    # List all test plans
POST   /api/v1/test-plans                    # Create test plan
GET    /api/v1/test-plans/:id                # Get test plan
PUT    /api/v1/test-plans/:id                # Update test plan
DELETE /api/v1/test-plans/:id                # Delete test plan
POST   /api/v1/test-plans/:id/duplicate      # Duplicate test plan
POST   /api/v1/test-plans/:id/export         # Export test plan
POST   /api/v1/test-plans/import             # Import test plan
```

#### Tree Nodes
```
GET    /api/v1/test-plans/:planId/nodes           # Get all nodes
POST   /api/v1/test-plans/:planId/nodes           # Create node
GET    /api/v1/test-plans/:planId/nodes/:nodeId   # Get node
PUT    /api/v1/test-plans/:planId/nodes/:nodeId   # Update node
DELETE /api/v1/test-plans/:planId/nodes/:nodeId   # Delete node
POST   /api/v1/test-plans/:planId/nodes/:nodeId/move  # Move node
POST   /api/v1/test-plans/:planId/nodes/:nodeId/duplicate  # Duplicate node
```

#### Code Generation
```
POST   /api/v1/nodes/:nodeId/generate        # Generate code for node
GET    /api/v1/nodes/:nodeId/code            # Get generated code
POST   /api/v1/nodes/:nodeId/regenerate      # Regenerate code
PUT    /api/v1/nodes/:nodeId/code            # Update code manually
```

#### Validation
```
POST   /api/v1/nodes/:nodeId/validate        # Validate node code
GET    /api/v1/nodes/:nodeId/validation      # Get validation status
POST   /api/v1/test-plans/:planId/validate   # Validate entire plan
```

#### Execution
```
POST   /api/v1/test-plans/:planId/execute    # Execute test plan
GET    /api/v1/executions/:executionId       # Get execution status
POST   /api/v1/executions/:executionId/stop  # Stop execution
GET    /api/v1/executions/:executionId/logs  # Get execution logs
GET    /api/v1/executions                    # List executions
```

#### Variables & Environments
```
GET    /api/v1/test-plans/:planId/variables       # List variables
POST   /api/v1/test-plans/:planId/variables       # Create variable
PUT    /api/v1/test-plans/:planId/variables/:id   # Update variable
DELETE /api/v1/test-plans/:planId/variables/:id   # Delete variable

GET    /api/v1/environments                       # List environments
POST   /api/v1/environments                       # Create environment
PUT    /api/v1/environments/:id                   # Update environment
DELETE /api/v1/environments/:id                   # Delete environment
```

### 7.2 WebSocket Events

```typescript
// Client -> Server
interface ClientEvents {
  'subscribe:execution': { executionId: string };
  'unsubscribe:execution': { executionId: string };
  'subscribe:validation': { nodeId: string };
}

// Server -> Client
interface ServerEvents {
  'execution:started': { executionId: string; testPlanId: string };
  'execution:node:started': { executionId: string; nodeId: string };
  'execution:node:completed': { executionId: string; result: NodeExecutionResult };
  'execution:node:log': { executionId: string; nodeId: string; log: string };
  'execution:completed': { executionId: string; status: ExecutionStatus };
  
  'validation:started': { nodeId: string };
  'validation:progress': { nodeId: string; validator: string; status: string };
  'validation:completed': { nodeId: string; results: ValidationResult[] };
  
  'generation:started': { nodeId: string };
  'generation:completed': { nodeId: string; code: GeneratedCode };
  'generation:failed': { nodeId: string; error: string };
}
```

---

## 8. Frontend Specification

### 8.1 Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── ProjectSelector
│   ├── UserMenu
│   └── GlobalActions (Run, Save, etc.)
│
├── MainLayout
│   ├── Sidebar (collapsible)
│   │   ├── TreeView
│   │   │   ├── TreeNode (recursive)
│   │   │   │   ├── NodeIcon
│   │   │   │   ├── NodeName
│   │   │   │   ├── NodeStatus
│   │   │   │   └── NodeActions (context menu)
│   │   │   └── AddNodeButton
│   │   └── TreeToolbar
│   │       ├── ExpandAll
│   │       ├── CollapseAll
│   │       ├── Search
│   │       └── Filter
│   │
│   ├── MainPanel
│   │   ├── NodeEditor
│   │   │   ├── NodeHeader
│   │   │   │   ├── NodeType indicator
│   │   │   │   ├── NodeName (editable)
│   │   │   │   └── EnableToggle
│   │   │   │
│   │   │   ├── ConfigurationTabs
│   │   │   │   ├── DescriptionTab
│   │   │   │   │   ├── IntentInput (natural language)
│   │   │   │   │   └── ContextHints
│   │   │   │   │
│   │   │   │   ├── ConfigurationTab (type-specific)
│   │   │   │   │   ├── JdbcConfig
│   │   │   │   │   ├── HttpConfig
│   │   │   │   │   ├── ScriptConfig
│   │   │   │   │   └── ... etc
│   │   │   │   │
│   │   │   │   ├── CodeTab
│   │   │   │   │   ├── CodeViewer (Monaco)
│   │   │   │   │   ├── GenerateButton
│   │   │   │   │   ├── RegenerateButton
│   │   │   │   │   ├── EditToggle
│   │   │   │   │   └── ValidationStatus
│   │   │   │   │
│   │   │   │   └── TestTab
│   │   │   │       ├── TestCodeViewer
│   │   │   │       ├── RunTestsButton
│   │   │   │       └── TestResults
│   │   │   │
│   │   │   └── NodeFooter
│   │   │       ├── ValidationSummary
│   │   │       └── ActionButtons
│   │   │
│   │   └── WelcomePanel (when no node selected)
│   │
│   └── BottomPanel (collapsible)
│       ├── ExecutionMonitor
│       │   ├── ExecutionProgress
│       │   ├── StepResults
│       │   └── LiveLogs
│       │
│       ├── ProblemsPanel
│       │   └── ValidationErrors
│       │
│       └── OutputPanel
│           └── ExecutionOutput
│
└── Modals
    ├── NewNodeModal
    ├── VariableEditorModal
    ├── EnvironmentEditorModal
    ├── ExecutionHistoryModal
    └── SettingsModal
```

### 8.2 Key UI Interactions

#### Tree View Interactions
```typescript
interface TreeViewProps {
  nodes: TreeNode[];
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  
  onNodeSelect: (nodeId: string) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeCollapse: (nodeId: string) => void;
  onNodeMove: (nodeId: string, newParentId: string, newIndex: number) => void;
  onNodeDuplicate: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeCreate: (parentId: string, type: NodeType) => void;
  onNodeRename: (nodeId: string, newName: string) => void;
  onNodeToggleEnabled: (nodeId: string) => void;
}

// Drag and drop for reordering
interface DragState {
  draggingNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'before' | 'after' | 'inside';
}
```

#### Intent Input with AI Feedback
```typescript
interface IntentInputProps {
  value: string;
  nodeType: NodeType;
  onChange: (value: string) => void;
  onGenerateCode: () => void;
  
  // AI-powered features
  suggestions: string[];          // Auto-complete suggestions
  clarificationQuestions?: string[]; // AI asks for clarification
  confidence: number;             // AI confidence in understanding
}
```

### 8.3 State Management

```typescript
// Global state structure (using Zustand or Redux)
interface AppState {
  // Current project
  currentTestPlan: TestPlan | null;
  
  // Tree state
  nodes: Record<string, TreeNode>;
  rootNodeId: string | null;
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  
  // Editor state
  editingNode: TreeNode | null;
  unsavedChanges: boolean;
  
  // Generation state
  generatingNodeIds: Set<string>;
  generationErrors: Record<string, string>;
  
  // Validation state
  validatingNodeIds: Set<string>;
  validationResults: Record<string, ValidationResult[]>;
  
  // Execution state
  currentExecution: TestExecution | null;
  executionHistory: TestExecution[];
  
  // UI state
  sidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  activeBottomTab: 'execution' | 'problems' | 'output';
  
  // Actions
  actions: {
    // Test plan actions
    loadTestPlan: (id: string) => Promise<void>;
    saveTestPlan: () => Promise<void>;
    
    // Node actions
    selectNode: (id: string) => void;
    createNode: (parentId: string, type: NodeType) => Promise<void>;
    updateNode: (id: string, updates: Partial<TreeNode>) => void;
    deleteNode: (id: string) => Promise<void>;
    moveNode: (id: string, newParentId: string, index: number) => Promise<void>;
    
    // Code generation actions
    generateCode: (nodeId: string) => Promise<void>;
    regenerateCode: (nodeId: string) => Promise<void>;
    updateCode: (nodeId: string, code: string) => void;
    
    // Validation actions
    validateNode: (nodeId: string) => Promise<void>;
    validateAllNodes: () => Promise<void>;
    
    // Execution actions
    executeTestPlan: (environmentId: string) => Promise<void>;
    stopExecution: () => Promise<void>;
  };
}
```

---

## 9. Technology Stack

### 9.1 Frontend
| Technology | Purpose |
|------------|---------|
| Angular 19 | UI Framework |
| TypeScript | Type safety |
| Angular Signals | State management |
| PrimeNG | UI Components |
| Monaco Editor | Code editing |
| Angular CDK | Drag and drop |
| CSS Variables | Theming (dark/light) |
| Socket.io Client | Real-time updates |
| Angular CLI | Build tool |

### 9.2 Backend
| Technology | Purpose |
|------------|---------|
| Node.js 20 | Runtime |
| TypeScript | Type safety |
| Fastify | HTTP framework |
| Socket.io | WebSocket server |
| Prisma | ORM |
| PostgreSQL | Primary database |
| Redis | Caching & queues |
| BullMQ | Job queue |
| Docker SDK | Container management |
| OpenAI/Anthropic SDK | AI integration |

### 9.3 Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Kubernetes (optional) | Orchestration |
| MinIO | Object storage (code artifacts) |
| Prometheus | Metrics |
| Grafana | Monitoring |
| Loki | Log aggregation |

---

## 10. Project Structure

```
testcraft/
├── apps/
│   ├── web/                          # Frontend application
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── tree/             # Tree view components
│   │   │   │   ├── editor/           # Node editor components
│   │   │   │   ├── execution/        # Execution monitor
│   │   │   │   └── common/           # Shared components
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── services/             # API clients
│   │   │   ├── types/                # TypeScript types
│   │   │   └── utils/                # Utilities
│   │   └── package.json
│   │
│   └── api/                          # Backend application
│       ├── src/
│       │   ├── modules/
│       │   │   ├── test-plans/       # Test plan management
│       │   │   ├── nodes/            # Node management
│       │   │   ├── generation/       # AI code generation
│       │   │   ├── validation/       # Code validation
│       │   │   ├── execution/        # Test execution
│       │   │   └── containers/       # Container orchestration
│       │   ├── common/               # Shared utilities
│       │   ├── config/               # Configuration
│       │   └── main.ts               # Entry point
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # Shared TypeScript types
│   ├── validators/                   # Validation logic
│   └── ai-prompts/                   # AI prompt templates
│
├── docker/
│   ├── runners/                      # Runner images
│   │   ├── java/
│   │   │   └── Dockerfile
│   │   ├── python/
│   │   │   └── Dockerfile
│   │   └── node/
│   │       └── Dockerfile
│   └── compose/
│       ├── docker-compose.yml        # Development
│       └── docker-compose.prod.yml   # Production
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Database migrations
│
├── docs/                             # Documentation
│   ├── architecture.md
│   ├── api.md
│   └── user-guide.md
│
├── turbo.json                        # Turborepo config
├── package.json                      # Root package.json
└── README.md
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Project setup with monorepo structure
- [ ] Database schema and migrations
- [ ] Basic REST API for test plans and nodes
- [ ] Frontend shell with routing
- [ ] Tree view component (display only)
- [ ] Basic node editor UI

### Phase 2: Core Tree Functionality (Weeks 4-5)
- [ ] Tree CRUD operations
- [ ] Drag and drop reordering
- [ ] Node type configurations
- [ ] Variable management
- [ ] Environment management

### Phase 3: AI Integration (Weeks 6-8)
- [ ] AI service integration (OpenAI/Anthropic)
- [ ] Prompt templates for each node type
- [ ] Code generation pipeline
- [ ] Code editor integration (Monaco)
- [ ] Generation status feedback

### Phase 4: Validation System (Weeks 9-11)
- [ ] Syntax validators per language
- [ ] Semantic validators
- [ ] Schema validators (DB, API)
- [ ] Security validators
- [ ] Dry-run validation
- [ ] Hallucination detection

### Phase 5: Execution Engine (Weeks 12-14)
- [ ] Docker runner images
- [ ] Container orchestrator
- [ ] Execution queue (BullMQ)
- [ ] Real-time execution feedback
- [ ] Log streaming
- [ ] Result collection

### Phase 6: Polish & Production (Weeks 15-16)
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] CI/CD pipeline
- [ ] Monitoring setup

---

## 12. Initial Setup Commands

```bash
# Create project structure
mkdir -p testcraft/{apps/{web,api},packages/{shared-types,validators,ai-prompts},docker/{runners/{java,python,node},compose},prisma,docs}

# Initialize monorepo
cd testcraft
npm init -y
npm install -D turbo

# Initialize frontend
cd apps/web
npm create vite@latest . -- --template react-ts
npm install zustand @tanstack/react-query socket.io-client @radix-ui/react-* @dnd-kit/core monaco-editor tailwindcss

# Initialize backend
cd ../api
npm init -y
npm install fastify @fastify/cors @fastify/websocket prisma @prisma/client bullmq ioredis dockerode openai
npm install -D typescript @types/node tsx

# Initialize shared packages
cd ../../packages/shared-types
npm init -y
npm install -D typescript
```

---

## 13. Success Criteria

### Functional Requirements
- [ ] User can create and manage test plans with tree structure
- [ ] User can describe steps in natural language
- [ ] AI generates valid, executable code
- [ ] Code passes all validation checks
- [ ] Tests execute in isolated containers
- [ ] Real-time feedback during execution
- [ ] Results are collected and displayed

### Non-Functional Requirements
- [ ] Code generation < 10 seconds
- [ ] Validation < 5 seconds per node
- [ ] Container startup < 3 seconds
- [ ] UI responsive (< 100ms interactions)
- [ ] Support 100 concurrent executions
- [ ] 99.9% uptime

### Quality Gates
- [ ] No hallucinated code reaches execution
- [ ] All generated code compiles
- [ ] Security vulnerabilities detected before execution
- [ ] Full audit trail of generations and executions

---

## Appendix A: Sample Node Configurations

### JDBC Node Example
```json
{
  "id": "node-001",
  "type": "jdbc",
  "name": "Get Active Users",
  "config": {
    "description": "Fetch all users who logged in within the last 7 days",
    "connectionRef": "db.main",
    "operation": "query",
    "intent": "Select all users from the users table where their last_login date is within the past 7 days. Include their id, email, and last_login timestamp.",
    "resultVariable": "activeUsers",
    "expectedSchema": {
      "tables": ["users"],
      "columns": ["id", "email", "last_login"]
    },
    "timeout": 30000,
    "retryCount": 2
  }
}
```

### HTTP Node Example
```json
{
  "id": "node-002",
  "type": "http",
  "name": "Create Order",
  "config": {
    "description": "Create a new order via REST API",
    "baseUrlRef": "api.baseUrl",
    "intent": "Send a POST request to create a new order with the items from the cart variable. Include authentication header from the auth token variable.",
    "pathParams": [],
    "queryParams": [],
    "responseVariable": "orderResponse",
    "expectedStatusCodes": [201],
    "timeout": 10000
  }
}
```

---

## Appendix B: AI Prompt Example

### Complete JDBC Generation Prompt
```
You are an expert Java developer generating production-ready JDBC code.

## Context
I need to generate code for a database query step in a test automation platform.

## Step Configuration
- Name: Get Active Users
- Intent: Select all users from the users table where their last_login date is within the past 7 days. Include their id, email, and last_login timestamp.
- Connection variable: db.main
- Result variable: activeUsers

## Database Schema
Table: users
- id: BIGINT (Primary Key)
- email: VARCHAR(255)
- password_hash: VARCHAR(255)
- last_login: TIMESTAMP
- created_at: TIMESTAMP
- status: VARCHAR(50)

## Available Variables
- db.main: javax.sql.DataSource - Database connection pool

## Requirements
1. Use try-with-resources for connection handling
2. Use PreparedStatement with parameterized queries
3. Return results as List<Map<String, Object>>
4. Include proper logging with SLF4J
5. Handle SQLException appropriately
6. Calculate the date 7 days ago in the query

## Output Format
Generate a single Java class with:
- Package: com.testcraft.generated
- Class name: GetActiveUsersStep
- Main method: execute(DataSource dataSource) -> List<Map<String, Object>>

Generate ONLY the Java code, no explanations.
```

---

This specification should give Claude Code everything needed to start building TestCraft AI. Start with Phase 1 and iterate!
