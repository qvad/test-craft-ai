# TestForgeAI — Complete Specification for AI Agents

> This document provides AI coding agents with everything needed to understand, modify, and extend the TestForgeAI platform. It is the authoritative reference for system architecture, data models, API contracts, conventions, and implementation details.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Build System & Toolchain](#3-build-system--toolchain)
4. [Shared Types — The Type System](#4-shared-types--the-type-system)
5. [API Server (Fastify)](#5-api-server-fastify)
6. [Web Frontend (Angular)](#6-web-frontend-angular)
7. [CLI Tool (Commander.js)](#7-cli-tool-commanderjs)
8. [Docker Runner Containers](#8-docker-runner-containers)
9. [Kubernetes Orchestration](#9-kubernetes-orchestration)
10. [Database (YugabyteDB)](#10-database-yugabytedb)
11. [HOCON Test Plan Format](#11-hocon-test-plan-format)
12. [AI & RAG Integration](#12-ai--rag-integration)
13. [WebSocket Protocol](#13-websocket-protocol)
14. [Execution Pipeline — End to End](#14-execution-pipeline--end-to-end)
15. [Testing Strategy](#15-testing-strategy)
16. [Security Model](#16-security-model)
17. [Configuration Reference](#17-configuration-reference)
18. [Code Conventions & Patterns](#18-code-conventions--patterns)
19. [Common Tasks for Agents](#19-common-tasks-for-agents)

---

## 1. System Overview

TestForgeAI (also referred to as TestCraft) is a visual test orchestration platform inspired by Apache JMeter. Users define test plans as trees of typed nodes (HTTP requests, database queries, assertions, controllers, etc.) using an HOCON configuration format or the web UI. An AI service generates executable code from natural-language intent. Code is executed inside language-specific Docker containers orchestrated via Kubernetes.

### Core Workflow

```
User creates test plan (HOCON or UI)
  → API parses plan into a node tree
  → AI generates executable code per node (optional)
  → Execution engine walks the tree
  → For each sampler node:
      → Picks a warm K8s pod (or creates one)
      → Copies code + dependencies into pod
      → Runs the runner script
      → Collects output JSON
  → Context manager propagates variables between nodes
  → Assertions validate results
  → Report generator produces JUnit/HTML/JSON/Markdown/CSV output
```

### Supported Languages

Java, Python, C#, JavaScript, TypeScript, Go, Rust, Ruby, PHP, Kotlin — each has a dedicated Docker runner image.

---

## 2. Repository Structure

```
TestForgeAI/                        # npm workspace root
├── apps/
│   ├── api/                        # @testcraft/api — Fastify REST server
│   │   ├── src/
│   │   │   ├── main.ts             # Server bootstrap
│   │   │   ├── config/index.ts     # All env-var-driven configuration
│   │   │   ├── common/             # Cross-cutting: logger, error-handler, rate-limiter,
│   │   │   │                       #   security-headers, safe-regex, constants
│   │   │   └── modules/            # Feature modules (see §5)
│   │   │       ├── auth/           # JWT + API key auth
│   │   │       ├── execution/      # Code execution endpoints
│   │   │       ├── containers/     # K8s orchestrator + routes
│   │   │       ├── ai/             # AI generation + RAG service
│   │   │       ├── hocon/          # HOCON parser, storage, routes
│   │   │       ├── context/        # Execution context + variable scoping
│   │   │       ├── reporting/      # Multi-format report generation
│   │   │       ├── testing/        # Node test execution (the big route file)
│   │   │       ├── websocket/      # Real-time event streaming
│   │   │       ├── database/       # YugabyteDB client + migrations
│   │   │       ├── health/         # Health check
│   │   │       ├── audit/          # Audit logging
│   │   │       ├── metrics/        # Prometheus-style metrics
│   │   │       └── docs/           # OpenAPI spec generation
│   │   ├── vitest.config.ts        # Test config (globals: true, env: node)
│   │   └── Dockerfile
│   │
│   ├── web/                        # @testcraft/web — Angular 21 frontend
│   │   ├── src/app/
│   │   │   ├── app.ts / app.routes.ts / app.config.ts
│   │   │   ├── core/services/      # API, AI, state, settings, theme services
│   │   │   ├── features/
│   │   │   │   ├── editor/         # Test plan editor (tree panel, node config, execution panel)
│   │   │   │   └── reports/        # Execution results viewer
│   │   │   └── shared/             # Components, models, pipes, config
│   │   ├── angular.json
│   │   └── package.json
│   │
│   └── cli/                        # @testcraft/cli — CLI tool ("testcraft" binary)
│       └── src/
│           ├── index.ts            # Commander.js setup
│           └── commands/           # run, validate, export, import, list
│
├── packages/
│   └── shared-types/               # @testcraft/shared-types — type definitions
│       └── src/
│           ├── nodes.ts            # ★ CANONICAL type source (NodeType, configs, interfaces)
│           ├── index.ts            # Re-exports from nodes.ts — DO NOT add types here
│           └── hocon-schema.ts     # HOCON schema validation types
│
├── docker/runners/                 # 10 language runner containers
│   ├── java/ python/ csharp/ javascript/ typescript/
│   ├── go/ rust/ ruby/ php/ kotlin/
│   ├── Dockerfile.api              # API server image
│   └── Dockerfile.ui               # Frontend nginx image
│
├── k8s/                            # Kubernetes manifests
│   ├── base/                       # Namespace, RBAC, ConfigMap, pod template
│   ├── runners/                    # Runner warm-pool Deployments
│   ├── api.yaml                    # API Deployment + HPA + PDB
│   ├── yugabyte.yaml               # Database StatefulSet
│   └── kustomization.yaml          # Kustomize overlay
│
├── tests/
│   ├── framework/                  # Custom test framework (185 tests)
│   │   ├── index.ts                # Suite registry (smoke, full, samplers, etc.)
│   │   ├── test-runner.ts          # Parallel runner with retry + coverage
│   │   └── test-cases/             # 15 test-case files
│   └── samples/                    # Sample code files for each language
│
├── docker-compose.yaml             # Local dev: YugabyteDB + runner containers
├── turbo.json                      # Turborepo task definitions
├── tsconfig.json                   # Root TypeScript config
├── Makefile                        # 40+ convenience targets
├── start.py                        # Dev orchestration script
├── CLAUDE.md                       # AI agent quick-reference
└── SPEC.md                         # Original project specification
```

---

## 3. Build System & Toolchain

### Workspace Layout

npm workspaces with Turborepo. Three apps (`api`, `web`, `cli`) and one shared package (`shared-types`).

### Key Commands

| Task | Command | Notes |
|------|---------|-------|
| Install all deps | `npm install` | From root |
| Build everything | `npm run build` | Turborepo respects `^build` dep order |
| Build one package | `npm run build:api` / `build:web` / `build:types` | Turbo filter |
| Start API (dev) | `npm run start:api` | `tsx watch` on port 3000 |
| Start frontend (dev) | `npm run start:web` | `ng serve` on port 4200 |
| Type check | `npm run typecheck` | All packages |
| Lint | `npm run lint` | ESLint via turbo |
| API unit tests | `npm run test:api` | Vitest |
| Single API test | `cd apps/api && npx vitest run src/__tests__/<file>.test.ts` | |
| Node integration tests | `npm run test:nodes` | Custom framework, all suites |
| Smoke tests | `npm run test:smoke` | Quick subset |
| Full test suite | `npm run test:full` | 185 tests |
| Suite-specific | `npm run test:samplers` / `test:controllers` / `test:assertions` / `test:http` | |
| DB migrations | `cd apps/api && npm run migrate` | |
| Docker infra up | `docker compose up -d yugabyte` | Port 5433 |
| Build runner images | `make docker-build` | All 10 languages |
| Clean everything | `npm run clean` | Removes all node_modules and .turbo |

### TypeScript Configuration

- Root: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`
- API: `module: NodeNext`, `moduleResolution: NodeNext`, declaration maps enabled
- Path alias: `@testcraft/shared-types` → `packages/shared-types/src/index.ts`

### Turborepo Pipeline

- `build` → depends on `^build`, cached
- `test` → depends on `build`, NOT cached
- `dev` / `start` → depends on `^build`, persistent
- `lint` / `typecheck` → cached

---

## 4. Shared Types — The Type System

**Location:** `packages/shared-types/src/nodes.ts`

This is the single source of truth for all TypeScript types used across the entire monorepo. The `index.ts` file re-exports via `export *` — **never add types to `index.ts` directly**.

### NodeType Union (129 types across 9 categories)

```typescript
export type NodeType =
  // Core (4): root, thread-group, setup-thread-group, teardown-thread-group
  // Samplers (17): http-request, jdbc-request, jms-publisher, jms-subscriber,
  //   tcp-sampler, smtp-sampler, ftp-request, ldap-request, graphql-request,
  //   grpc-request, websocket-request, kafka-producer, kafka-consumer,
  //   mongodb-request, redis-request, shell-command, script-sampler
  // Controllers (15): loop-controller, while-controller, foreach-controller,
  //   if-controller, switch-controller, transaction-controller,
  //   throughput-controller, runtime-controller, interleave-controller,
  //   random-controller, random-order-controller, once-only-controller,
  //   module-controller, include-controller, parallel-controller
  // Timers (7): constant-timer, uniform-random-timer, gaussian-random-timer,
  //   poisson-random-timer, constant-throughput-timer, precise-throughput-timer,
  //   synchronizing-timer
  // Pre-Processors (5): user-parameters, html-link-parser,
  //   http-url-rewriting-modifier, beanshell-preprocessor, jsr223-preprocessor
  // Post-Processors (8): regex-extractor, json-extractor, xpath-extractor,
  //   css-extractor, boundary-extractor, result-status-handler,
  //   beanshell-postprocessor, jsr223-postprocessor
  // Assertions (12): response-assertion, json-assertion, json-schema-assertion,
  //   xpath-assertion, duration-assertion, size-assertion, md5hex-assertion,
  //   compare-assertion, html-assertion, xml-assertion, beanshell-assertion,
  //   jsr223-assertion
  // Config Elements (13): csv-data-set, http-request-defaults,
  //   http-header-manager, http-cookie-manager, http-cache-manager,
  //   http-authorization-manager, jdbc-connection-config, keystore-config,
  //   login-config, counter, random-variable, user-defined-variables,
  //   dns-cache-manager
  // Listeners (5): view-results-tree, summary-report, aggregate-report,
  //   backend-listener, simple-data-writer
  // AI Nodes (9): ai-test-generator, ai-data-generator, ai-response-validator,
  //   ai-load-predictor, ai-anomaly-detector, ai-scenario-builder,
  //   ai-assertion, ai-extractor, ai-script
```

### NODE_CATEGORIES Constant

```typescript
export const NODE_CATEGORIES = {
  core: [...],       // 4 types
  samplers: [...],   // 17 types
  controllers: [...], // 15 types
  timers: [...],     // 7 types
  preprocessors: [...], // 5 types
  postprocessors: [...], // 8 types
  assertions: [...], // 12 types
  config: [...],     // 13 types
  listeners: [...],  // 5 types
  ai: [...]          // 9 types
} as const;
```

### Core Data Interfaces

```typescript
// Base config shared by all nodes
export interface BaseNodeConfig {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  continueOnError?: boolean;
  description?: string;
  enabled?: boolean;
}

// NodeConfig is a discriminated union extending BaseNodeConfig
export type NodeConfig =
  | HttpRequestConfig    // method, url, headers, body, params, auth, followRedirects
  | JdbcRequestConfig    // connectionRef, queryType, query, parameterValues, resultVariable
  | GraphqlRequestConfig // endpoint, query, variables, operationName
  | GrpcRequestConfig    // host, port, service, method, protoFile, message
  | WebsocketRequestConfig // url, message, expectedResponse
  | KafkaConfig          // brokers, topic, message/groupId
  | MongodbRequestConfig // connectionString, database, collection, operation, query
  | RedisRequestConfig   // host, port, command, args
  | ShellCommandConfig   // command, workingDirectory, environment, expectedExitCode
  | ScriptSamplerConfig  // language, script, inputVariables, outputVariables
  | LoopControllerConfig // count, indexVariable
  | WhileControllerConfig // condition
  | IfControllerConfig   // condition, useExpression
  | SwitchControllerConfig // switchValue, cases
  | TransactionControllerConfig // generateParentSample, includeTimers
  | TimerConfig          // delay, range, deviation, throughput
  | AssertionConfig      // testField, testType, testStrings, negate
  | ExtractorConfig      // expression, matchNumber, defaultValue, variable
  | CsvDataSetConfig     // filename, variableNames, delimiter, recycle, stopThread
  | HttpDefaultsConfig   // protocol, domain, port, path, contentEncoding
  | AiNodeConfig         // intent, language, model, temperature, maxTokens
  | BaseNodeConfig;      // fallback

// Tree structure
export interface TreeNode {
  id: string;
  testPlanId: string;
  parentId: string | null;
  type: NodeType;
  name: string;
  config: NodeConfig;
  children: string[];
  enabled?: boolean;
  generatedCode?: GeneratedCode;
  validationStatus?: 'pending' | 'valid' | 'invalid' | 'warning';
  validationErrors?: ValidationError[];
}

// Test plan
export interface TestPlan {
  id: string;
  name: string;
  version?: string;
  description?: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
  variables: Variable[];
  environments: Environment[];
  tags?: string[];
  status: TestPlanStatus; // 'draft' | 'ready' | 'running' | 'completed' | 'failed'
  createdAt: Date;
  updatedAt: Date;
}

// Code execution
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
  output?: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export type SupportedLanguage =
  | 'java' | 'python' | 'csharp' | 'javascript' | 'typescript'
  | 'go' | 'rust' | 'ruby' | 'php' | 'kotlin';

// Variable system
export interface Variable {
  name: string;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'secret' | 'expression';
  scope?: 'global' | 'plan' | 'thread';
  description?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: Variable[];
  isDefault?: boolean;
}
```

### LANGUAGE_INFO Map

```typescript
export const LANGUAGE_INFO: Record<SupportedLanguage, {
  displayName: string;
  extension: string;
  dockerImage: string;
  compilable: boolean;
}> = {
  java:       { displayName: 'Java',       extension: '.java', dockerImage: 'testcraft-runner-java',       compilable: true },
  python:     { displayName: 'Python',     extension: '.py',   dockerImage: 'testcraft-runner-python',     compilable: false },
  csharp:     { displayName: 'C#',         extension: '.cs',   dockerImage: 'testcraft-runner-csharp',     compilable: true },
  javascript: { displayName: 'JavaScript', extension: '.js',   dockerImage: 'testcraft-runner-javascript', compilable: false },
  typescript: { displayName: 'TypeScript', extension: '.ts',   dockerImage: 'testcraft-runner-typescript', compilable: false },
  go:         { displayName: 'Go',         extension: '.go',   dockerImage: 'testcraft-runner-go',         compilable: true },
  rust:       { displayName: 'Rust',       extension: '.rs',   dockerImage: 'testcraft-runner-rust',       compilable: true },
  ruby:       { displayName: 'Ruby',       extension: '.rb',   dockerImage: 'testcraft-runner-ruby',       compilable: false },
  php:        { displayName: 'PHP',        extension: '.php',  dockerImage: 'testcraft-runner-php',        compilable: false },
  kotlin:     { displayName: 'Kotlin',     extension: '.kt',   dockerImage: 'testcraft-runner-kotlin',     compilable: true },
};
```

---

## 5. API Server (Fastify)

### Entry Point: `apps/api/src/main.ts`

Bootstrap sequence:
1. Create Fastify instance (with optional TLS)
2. Register plugins (in order): security headers → CORS → WebSocket → error handler → metrics → rate limiter → auth
3. Register routes (all under `/api/v1/` prefix)
4. Initialize database + run migrations
5. Set up graceful shutdown (SIGINT, SIGTERM, SIGQUIT — 30s timeout)
6. Listen on `0.0.0.0:${PORT}`

### Module Architecture

Every API module lives in `apps/api/src/modules/<name>/` and exports a route registration function:

```typescript
// Pattern for every module:
export async function fooRoutes(app: FastifyInstance): Promise<void> {
  app.get('/endpoint', async (request, reply) => { ... });
  app.post('/endpoint', async (request, reply) => { ... });
}

// Registered in main.ts:
await app.register(fooRoutes, { prefix: '/api/v1/foo' });
```

### Route Map

| Prefix | Module | Auth | Description |
|--------|--------|------|-------------|
| `/api/v1/health` | health | Public | Liveness + readiness probes |
| `/api/v1/auth` | auth | Mostly public | Login, register, refresh, logout, API keys |
| `/api/v1/executions` | execution | Required | Execute code, get status, list executions |
| `/api/v1/containers` | containers | Required | K8s pod management, pool status, language list |
| `/api/v1/reports` | reporting | Required | Generate reports, record steps, list executions |
| `/api/v1` (plans/*) | hocon | Required | HOCON import/export, plan CRUD, validate, execute, clone |
| `/api/v1` (context) | context | Required | Execution context, variables, connections, snapshots |
| `/api/v1/ai` | ai | Required + stricter rate limit | Code generation, data generation, RAG search, LM Studio proxy |
| `/api/v1` (testing) | testing | Required | Node type testing — the large route file with real implementations |
| `/api/v1/audit` | audit | Admin only | Audit log retrieval |
| `/api/v1/docs` | docs | Public | OpenAPI/Swagger documentation |
| `/ws` | websocket | JWT via query param | Real-time execution updates |

### Module Details

#### auth (JWT + API Key)

- **auth.plugin.ts**: Fastify plugin that decorates requests with `user`, `scopes`, `authMethod`. Skips auth for public routes. In dev mode with `AUTH_SKIP_IN_DEV=true`, injects a dev user.
- **auth.service.ts**: Custom HS256 JWT implementation, password hashing via `crypto.scrypt`, API key generation/verification, role-based scopes (`admin`, `user`, `viewer`).
- **Routes**: POST `/login`, POST `/register`, POST `/refresh`, POST `/logout`, GET `/me`, GET/POST/DELETE `/api-keys`, GET `/users` (admin).

#### execution

- POST `/` — Execute code (async, returns executionId). Uses warm pool or creates new K8s pod.
- POST `/sync` — Synchronous execution (blocks until result).
- GET `/:executionId` — Poll execution status.
- GET `/` — List recent executions.
- POST `/test/:language` — Quick language smoke test.

#### containers

- **orchestrator.ts**: Core execution logic.
  - `executeWithWarmPool()` — Finds an available warm pod for the language, copies code, runs.
  - `executeWithNewPod()` — Creates a fresh pod when no warm pods available.
  - Handles dependency installation per language before execution.
  - Phases logged: FIND_POD → COPY_CODE → INSTALL_DEPS → EXECUTE → PARSE_OUTPUT → CLEANUP.
- **k8s-client.ts**: Kubernetes API wrapper.
- **Routes**: GET `/languages`, GET `/pools`, GET `/pools/:language`, POST `/pools/:language/scale`.

#### ai

- **ai-service.ts**: AI code generation with RAG context enrichment.
  - `generateCode(intent, language, context)` — Builds prompt with RAG results, calls AI API, returns code.
  - `generateData(schema, count)` — Test data generation.
  - `validateResponse(expected, actual)` — AI-powered response validation.
  - `detectAnomalies(metrics)` — Anomaly detection in performance metrics.
- **rag-service.ts**: Vector similarity search using pgvector (`<=>` cosine distance operator).
  - Document indexing with embeddings.
  - Specialized indexers for code examples, API docs, DB schemas.
  - Batch import/export for RAG knowledge base backup.
- **Routes**: POST `/complete`, POST `/generate/code`, POST `/generate/data`, POST `/validate`, POST `/anomalies/detect`, POST/GET `/rag/*`, POST `/lm-studio/complete`.
- **SSRF protection**: The LM Studio proxy validates target URLs against private IP ranges before forwarding.

#### hocon

- **parser.ts**: Full HOCON parser (comments, multi-line strings, variable substitution `${var}`, includes, environment overrides). Parses to tree of `TreeNode` objects with generated IDs.
- **storage.ts**: Dual-backend storage (database or filesystem fallback). Version history tracking.
- **Routes**: POST `/plans/import`, GET `/plans/:id/export`, GET/PUT/DELETE `/plans/:id`, GET `/plans`, POST `/plans/validate`, POST `/plans/execute`, POST `/plans/:id/clone`, GET `/plans/:id/history`, GET `/plans/tags`.

#### context

- **context-manager.ts**: Variable scoping (global → plan → node → thread). Encrypts sensitive values with AES-256-GCM. Generates code injection snippets per language (e.g., Python: `var_name = "value"`). Context snapshot/restore.
- **context-service.ts**: Background metric collectors — Prometheus scraper, system resource monitor, HTTP endpoint monitor, database monitor, custom metrics.
- **Routes**: POST/GET `/executions/:id/context/variables`, POST `/executions/:id/context/connections`, POST `/executions/:id/context/code-injection`, POST `/executions/:id/context/snapshots`.

#### reporting

- **report-generator.ts**: Generates reports in 5 formats: JSON, HTML, JUnit XML, Markdown, CSV. Calculates percentiles (p50/p90/p95/p99), throughput, error rates. Masks sensitive data.
- **types.ts**: `ExecutionReport`, `StepResult`, `ExecutionSummary`, `AssertionResult`, `TestMetrics`, `ReportFormat`.
- **Routes**: GET `/executions`, GET `/executions/:id/report?format=`, POST `/executions/:id/reports`, GET `/executions/:id/summary`, POST/GET `/executions/:id/steps`.

#### testing

The largest route file (~700 lines). Contains real implementations for testing individual node types: HTTP requests (via axios), JDBC queries (via pg), code execution (via K8s), timers, assertions, extractors, controllers. Implements `substituteVariables()` for `${var}` replacement in all config values.

#### websocket

- Endpoint: `GET /ws` (WebSocket upgrade)
- Auth: JWT token via `?token=` query parameter
- Client subscription model: clients subscribe to execution IDs or validation node IDs
- Message types: `subscribe:execution`, `unsubscribe:execution`, `subscribe:validation`, `unsubscribe:validation`, `ping`/`pong`
- Server broadcasts: `broadcastExecutionEvent(executionId, event)`, `broadcastValidationEvent(nodeId, event)`, `broadcastToAll(event)`

### Common Utilities (`apps/api/src/common/`)

| File | Purpose |
|------|---------|
| `logger.ts` | Pino logger configured from `config.logging`. Import as: `import { logger } from '../../common/logger.js'` |
| `error-handler.ts` | `AppError` class with factory methods (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `internal`). Fastify plugin for centralized error handling. Zod validation error formatting. |
| `rate-limiter.ts` | Token bucket rate limiter. `rateLimitPlugin` for global limits, `createRateLimitMiddleware()` for per-route limits. |
| `security-headers.ts` | Fastify plugin that sets CSP, HSTS, X-Content-Type-Options, X-Frame-Options, etc. |
| `safe-regex.ts` | ReDoS-safe regex construction/testing. `safeRegex()`, `safeRegexTest()`, `safeRegexExec()`. |
| `constants.ts` | All magic numbers: `EXECUTION_CONSTANTS`, `AI_CONSTANTS`, `BUFFER_CONSTANTS`, `HTTP_CONSTANTS`, `K8S_CONSTANTS`, `VALIDATION_CONSTANTS`, `SUPPORTED_LANGUAGES`. |

### Request Validation

All routes use Zod schemas for request validation:

```typescript
import { z } from 'zod';
const ExecuteSchema = z.object({
  language: z.enum(['java', 'python', ...]),
  code: z.string().min(1),
  timeout: z.number().optional(),
});
app.post('/', async (request) => {
  const body = ExecuteSchema.parse(request.body);
  // ...
});
```

---

## 6. Web Frontend (Angular)

### Stack

- **Angular 21** with standalone components
- **PrimeNG 21** component library + PrimeIcons
- **Angular Signals** for reactive state management
- **RxJS** for async operations

### Architecture

```
app.ts                          # Root component (standalone)
app.routes.ts                   # Routing: '' → EditorPage, 'reports' → ReportsPage, etc.
app.config.ts                   # App configuration, providers

core/services/
  api/
    base-api.service.ts         # Base HTTP service (configurable base URL)
    plans-api.service.ts        # Test plan CRUD API calls
    execution-api.service.ts    # Execution API calls
    websocket.service.ts        # WebSocket client
  ai/
    ai-api.service.ts           # AI generation API calls
    auto-fill.service.ts        # AI-powered form field auto-completion
    field-metadata.service.ts   # Node field metadata for AI
    prompt-improvement.service.ts # AI prompt refinement
    correction-memory.service.ts # Remembers AI corrections
  state/
    test-plan.store.ts          # TestPlanStore — signal-based store for current plan + nodes
    execution.store.ts          # ExecutionStore — execution state, WebSocket integration
    tree-selection.store.ts     # TreeSelectionStore — selected/expanded node tracking
    reports.store.ts            # ReportsStore — execution history + report data
  settings/
    settings.service.ts         # User preferences (language, theme, API URL)
  theme/
    theme.service.ts            # Dark/light theme toggle
  node-registry.service.ts      # Registry of all node types with metadata + allowed children

features/
  editor/
    pages/editor-page.ts        # Main editor layout (3-panel: tree, config, execution)
    components/
      app-shell/                # Top-level shell with toolbar
      tree-panel/               # Tree view with drag-and-drop, context menu
      node-config/              # Node configuration form (dynamic per node type)
      top-toolbar/              # Toolbar actions (save, run, validate, undo)
      execution-panel/          # Live execution output
      auto-fill-dialog/         # AI auto-fill dialog
  reports/
    pages/reports-page.ts       # Reports list
    pages/results-viewer-page.ts # Detailed execution results
    components/                 # Summary cards, steps tree, assertion results, filters

shared/
  components/
    code-editor.ts              # Code editor component (textarea-based)
    node-type-icon.ts           # Icon component per node type
  models/
    node.model.ts               # Frontend node model
    test-plan.model.ts          # Frontend test plan model
  config/
    form-options.ts             # Dropdown options (HTTP methods, protocols, query types, etc.)
    ai-prompts.ts               # System prompts for AI features
  pipes/
    node-type-label.pipe.ts     # Transforms node type slug to display label
```

### State Management Pattern

All stores use Angular signals:

```typescript
@Injectable({ providedIn: 'root' })
export class TestPlanStore {
  // State
  readonly plan = signal<TestPlan | null>(null);
  readonly nodes = signal<Record<string, TreeNode>>({});
  readonly loading = signal(false);
  readonly dirty = signal(false);

  // Computed
  readonly rootNode = computed(() => { ... });
  readonly nodeList = computed(() => Object.values(this.nodes()));

  // Actions
  loadPlan(id: string): Promise<void> { ... }
  updateNode(id: string, updates: Partial<TreeNode>): void { ... }
  addNode(parentId: string, type: NodeType): void { ... }
  removeNode(id: string): void { ... }
  moveNode(id: string, newParentId: string, index: number): void { ... }
}
```

### Node Config Panel

The `NodeConfigPanelComponent` is the largest UI component. It renders different form fields depending on the selected node's `type`:

- `http-request` → URL, method, headers, body, auth
- `jdbc-request` → connection ref, query type, SQL, result variable
- `graphql-request` → endpoint, query, variables
- `grpc-request` → host, port, service, method, proto, message
- `script-sampler` → language, code editor
- `ai-*` nodes → intent, model, temperature, language
- Assertions → test field, test type, test strings, negate
- Controllers → condition, count, switch value
- Timers → delay, range
- Config elements → CSV filename, HTTP defaults, header/cookie managers
- `context-setup` → database connections, context variables

Each node type has a `@switch` block in the template rendering the appropriate form fields.

### NodeRegistryService

Maps every `NodeType` to metadata:

```typescript
{
  type: 'http-request',
  category: 'samplers',
  label: 'HTTP Request',
  icon: 'pi-globe',
  description: 'Send HTTP/HTTPS requests',
  allowedChildren: ['response-assertion', 'json-extractor', ...],
  configDefaults: { method: 'GET', protocol: 'https', ... }
}
```

---

## 7. CLI Tool (Commander.js)

**Package:** `apps/cli/`, **Binary:** `testcraft`

### Commands

```
testcraft run <file>              # Execute test plan
  -e, --environment <env>         # Target environment
  -v, --var KEY=VALUE             # Variable overrides (repeatable)
  -o, --output <dir>              # Report output directory
  -f, --format <fmt...>           # Report formats: json, junit, html, allure
  --api-url <url>                 # API server URL (default: http://localhost:3000)
  --parallel                      # Parallel execution
  --dry-run                       # Validate only, no execution
  --verbose                       # Debug output
  --ci                            # CI mode: exit 1 on test failure

testcraft validate <file>         # Validate HOCON syntax + structure
  --strict                        # Fail on warnings

testcraft export <id> <file>      # Download plan from server → HOCON file
testcraft import <file>           # Upload HOCON file → server
  --name <name>                   # Override plan name

testcraft list                    # List server plans
  --tags <tag...>                 # Filter by tags
  --search <query>                # Search by name

testcraft init                    # Scaffold new test plan
  -t, --template <type>           # http, database, load, ai
  -o, --output <file>             # Output file path
```

### Run Command Flow

1. Read HOCON file from disk
2. Parse `--var` overrides into `Record<string, string>`
3. POST to `/api/v1/plans/import` to parse the plan
4. POST to `/api/v1/plans/execute` with variables and environment
5. Connect WebSocket to `/ws?token=...` for real-time progress
6. Display live progress (spinner + step results)
7. On completion, fetch reports in requested formats
8. Write reports to output directory
9. In `--ci` mode, exit with code 1 if any tests failed

---

## 8. Docker Runner Containers

**Location:** `docker/runners/<language>/`

Each language has:
- `Dockerfile` — Base image, system deps, non-root user (`runner:testcraft`), dependency pre-installation
- `runner.sh` — Entry script that compiles (if needed), executes code, returns JSON result

### Runner Script Contract

**Input:**
- Code file at `${CODE_DIR}/main.<ext>` (written via K8s exec before runner starts)
- Optional stdin
- Environment variables: `TIMEOUT` (seconds, default 60), `CODE_DIR`, `OUTPUT_DIR`

**Output:** JSON written to `${OUTPUT_DIR}/result.json`:

```json
{
  "status": "success",       // "success" | "error" | "timeout"
  "language": "java",
  "duration_ms": 1234,
  "output": "stdout content",
  "error": "stderr content",  // if status != success
  "exit_code": 0
}
```

### Language-Specific Details

| Language | Base Image | Compilation | Memory | Notes |
|----------|-----------|-------------|--------|-------|
| Java | eclipse-temurin:21-jdk-alpine | javac + java | -Xmx512m | Extracts class name from source |
| Python | python:3.12-slim | None | — | PYTHONUNBUFFERED=1 |
| C# | mcr.microsoft.com/dotnet/sdk:8.0-alpine | dotnet build | — | Uses template.csproj |
| JavaScript | node:20-alpine | None | — | |
| TypeScript | node:20-alpine | npx tsx | — | Direct TS execution, no tsc |
| Go | golang:1.22-alpine | go build | — | Uses go.mod for deps |
| Rust | rust:1.76-alpine | cargo build | — | Uses Cargo.toml template |
| Ruby | ruby:3.3-alpine | None | — | Uses Gemfile |
| PHP | php:8.3-cli-alpine | None | — | Uses composer.json |
| Kotlin | eclipse-temurin:21-jdk-alpine | kotlinc + java | — | Higher memory allocation |

### Important Constraint

All runners use **Alpine Linux**. BusyBox `date` does NOT support `%N` (nanoseconds). Duration is measured using `$(date +%s)` arithmetic (second precision) or POSIX-compliant alternatives.

---

## 9. Kubernetes Orchestration

### Namespace: `testcraft-runners`

### RBAC

- **ServiceAccount `testcraft-runner`** — Used by runner pods. Can get/list/watch pods, get pods/log, get configmaps/secrets.
- **ServiceAccount `testcraft-orchestrator`** — Used by the API server. Full create/get/list/update/delete on pods, configmaps, secrets, services.

### Runner Warm Pool

Pre-created Deployments that run `sleep infinity`, keeping pods warm for immediate code execution:

```yaml
# From k8s/runners/all-runners.yaml
Deployments (replicas): JavaScript(2), TypeScript(2), Go(2), Rust(1), Ruby(1), PHP(1), Kotlin(1)
# From k8s/runners/ individual files:
Java(2), Python(2), C#(2)
```

Warm pool pods use labels: `app: testcraft-runner`, `testcraft.io/language: <language>`, `testcraft.io/pool: warm`.

### Pod Template (`k8s/base/pod-template.yaml`)

Dynamic pods created for cold-start execution:

```yaml
# Placeholders replaced at runtime:
# {{EXECUTION_ID}}, {{LANGUAGE}}, {{IMAGE}}, {{TIMEOUT}}
securityContext:
  runAsUser: 1000
  runAsNonRoot: true
  readOnlyRootFilesystem: true
resources:
  requests: { cpu: 100m, memory: 256Mi }
  limits:   { cpu: "1", memory: 1Gi }
volumes:
  - emptyDir: {} # /app/code
  - emptyDir: {} # /app/output
```

### API Deployment (`k8s/api.yaml`)

- 2 replicas with rolling update
- HPA: 2–10 replicas (70% CPU / 80% memory targets)
- PDB: minAvailable 1
- Health probes: startup (30s), readiness (10s), liveness (15s) — all on `/api/v1/health`
- Non-root, read-only filesystem
- Secrets mounted from `testcraft-secrets` for DB password, JWT secret, AI API key

### ConfigMap (`k8s/base/configmap.yaml`)

Runner image tags, default timeout (60s), max memory (512m), log level.

### Kustomization

Kustomize overlay applies namespace `testcraft-runners`, common labels, and image tag management for all 10 runner images.

---

## 10. Database (YugabyteDB)

### Connection

YugabyteDB is PostgreSQL-compatible (wire protocol). Accessed on port **5433** (not 5432).

```typescript
// apps/api/src/modules/database/yugabyte-client.ts
import { Pool } from 'pg';
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,    // 5433
  database: config.database.name, // testcraft
  user: config.database.user,     // yugabyte
  password: config.database.password,
  ssl: config.database.ssl,
  max: config.database.poolSize,
});
```

### Migrations (`apps/api/src/modules/database/migrations.ts`)

SQL-based sequential migrations. Tables created:

- `migrations` — Migration tracking
- `test_plans` — Test plan storage (JSONB for nodes, variables)
- `test_plan_history` — Version history
- `executions` — Execution records
- `execution_steps` — Individual step results
- `rag_documents` — RAG knowledge base (with pgvector `vector(1536)` column for embeddings)
- `users` — User accounts
- `api_keys` — API key storage
- `jwt_revocations` — Revoked JWT tokens
- `sessions` — Active sessions
- `audit_log` — Audit trail

Run migrations: `cd apps/api && npm run migrate`

### pgvector for RAG

Embeddings stored as `vector(1536)` columns. Similarity search uses cosine distance: `ORDER BY embedding <=> $1 LIMIT $2`.

---

## 11. HOCON Test Plan Format

HOCON (Human-Optimized Config Object Notation) is the primary format for defining test plans.

### Basic Structure

```hocon
testcraft {
  plan {
    name = "My Test Plan"
    version = "1.0"
    description = "Description"
    tags = ["smoke", "api"]

    variables {
      base_url = "https://api.example.com"
      base_url = ${?API_BASE_URL}  // env override
      api_key = ${SECRET_API_KEY}
    }

    environments {
      dev {
        base_url = "http://localhost:3000"
      }
      staging {
        base_url = "https://staging.example.com"
      }
    }

    nodes {
      thread-group-1 {
        type = thread-group
        name = "Main Users"
        threads = 10
        rampUp = 30
        loops = 5

        children {
          http-get-1 {
            type = http-request
            name = "Get Users"
            method = GET
            url = "${base_url}/api/users"
            headers {
              Authorization = "Bearer ${api_key}"
              Content-Type = "application/json"
            }

            children {
              json-assert-1 {
                type = json-assertion
                name = "Verify response"
                jsonPath = "$.data"
                expectedValue = "not-empty"
              }
              json-extract-1 {
                type = json-extractor
                name = "Extract user ID"
                jsonPath = "$.data[0].id"
                variable = "user_id"
              }
            }
          }
        }
      }
    }

    hooks {
      beforeAll = "echo 'Starting test'"
      afterAll = "echo 'Tests complete'"
      onFailure = "echo 'Test failed: ${__lastError}'"
    }
  }
}
```

### Built-in Functions

Available as `${__functionName(args)}`:
- `${__uuid()}` — Generate UUID
- `${__timestamp()}` — Current epoch millis
- `${__timestamp("yyyy-MM-dd")}` — Formatted timestamp
- `${__random(min, max)}` — Random integer
- `${__randomString(length)}` — Random alphanumeric
- `${__counter()}` — Auto-incrementing counter
- `${__env(VAR_NAME)}` — Environment variable
- `${__property(key)}` — System property

### Variable Substitution

`${varName}` is replaced at execution time from context (plan variables → environment overrides → runtime overrides). Supports nested: `${outer_${inner}}`.

---

## 12. AI & RAG Integration

### AI Code Generation Flow

1. User provides natural-language `intent` for a node (e.g., "Send a POST request to create a user with JSON body")
2. RAG service searches knowledge base for relevant examples
3. AI service builds a prompt combining:
   - Node type and config
   - Available context variables
   - RAG results (code examples, API docs, DB schemas)
   - Target language
4. AI generates executable code
5. Code is stored in `TreeNode.generatedCode`
6. Code is validated (syntax, security)
7. On execution, code runs in the language runner container

### RAG Service

**Storage:** pgvector in YugabyteDB. Documents are chunked, embedded (1536-dim vectors), and stored.

**Indexing Endpoints:**
- `POST /api/v1/ai/rag/documents` — General document indexing
- `POST /api/v1/ai/rag/code-examples` — Code example indexing (with language metadata)
- `POST /api/v1/ai/rag/api-docs` — API specification indexing
- `POST /api/v1/ai/rag/db-schemas` — Database schema indexing

**Search:** `POST /api/v1/ai/rag/search` with query string, returns top-k similar documents.

**Backup:** `GET /api/v1/ai/rag/export` (JSON dump), `POST /api/v1/ai/rag/import` (restore).

### AI API Configuration

```
AI_API_KEY=...           # Anthropic/OpenAI API key
AI_BASE_URL=...          # API endpoint (supports Anthropic, OpenAI, LM Studio)
AI_MODEL=claude-sonnet-4-5-20250929  # Default model
AI_EMBEDDING_MODEL=...   # Embedding model for RAG
```

### LM Studio Proxy

`POST /api/v1/ai/lm-studio/complete` proxies requests to a local LM Studio server. Validates target URL to prevent SSRF (blocks private IP ranges: 10.x, 172.16-31.x, 192.168.x, 127.x, ::1).

---

## 13. WebSocket Protocol

### Connection

```
ws://localhost:3000/ws?token=<JWT>
```

Browser WebSocket API cannot set custom headers, so JWT is passed via query parameter.

### Client → Server Messages

```json
{ "type": "subscribe:execution", "executionId": "uuid" }
{ "type": "unsubscribe:execution", "executionId": "uuid" }
{ "type": "subscribe:validation", "nodeId": "uuid" }
{ "type": "unsubscribe:validation", "nodeId": "uuid" }
{ "type": "ping" }
```

### Server → Client Messages

```json
{ "type": "connected", "timestamp": 1234567890 }
{ "type": "pong" }
{ "type": "execution:started", "executionId": "...", "timestamp": "..." }
{ "type": "execution:step-started", "executionId": "...", "nodeId": "...", "nodeName": "..." }
{ "type": "execution:step-completed", "executionId": "...", "nodeId": "...", "status": "success", "duration": 1234 }
{ "type": "execution:completed", "executionId": "...", "status": "success", "summary": {...} }
{ "type": "execution:failed", "executionId": "...", "error": "..." }
{ "type": "validation:result", "nodeId": "...", "status": "valid", "errors": [] }
```

---

## 14. Execution Pipeline — End to End

### Step 1: Parse Test Plan

HOCON file → parser.ts → `TestPlan` with tree of `TreeNode` objects.

### Step 2: Resolve Variables

Environment overrides applied → CLI `--var` overrides applied → built-in functions evaluated.

### Step 3: Walk the Tree

The execution engine processes nodes depth-first:

```
root
└── thread-group (spawn N threads, ramp-up)
    ├── http-request (sampler → execute code)
    │   ├── json-extractor (post-processor → extract values)
    │   └── response-assertion (assertion → verify)
    ├── if-controller (evaluate condition)
    │   └── jdbc-request (sampler → execute code)
    └── constant-timer (pause)
```

**Processing rules:**
- **Thread Groups**: Create N virtual threads with ramp-up delay
- **Samplers**: Generate code (if AI), execute in K8s runner, collect result
- **Controllers**: Control flow (loops, conditions, switches)
- **Pre-Processors**: Run before the sampler in the same scope
- **Post-Processors / Extractors**: Run after sampler, extract values into context
- **Assertions**: Validate the sampler result, mark pass/fail
- **Timers**: Introduce delays between samplers
- **Listeners**: Collect and report results
- **Config Elements**: Set defaults for child samplers

### Step 4: Execute Code in K8s

```
1. Orchestrator receives ExecutionRequest { language, code, timeout, dependencies }
2. Find warm pod: kubectl get pods -l testcraft.io/language=python,testcraft.io/pool=warm
3. (Or create new pod from pod-template.yaml)
4. Install dependencies: pip install <deps> (via kubectl exec)
5. Copy code: echo "<code>" | kubectl exec -i pod -- tee /app/code/main.py
6. Run: kubectl exec pod -- /app/runner.sh
7. Read result: kubectl exec pod -- cat /app/output/result.json
8. Parse JSON result → ExecutionResult
9. Return to execution engine
```

### Step 5: Context Propagation

After each sampler executes:
- Post-processors extract values from the response
- Extracted values are stored in the context with their variable names
- Next node can reference extracted values via `${variable_name}`
- Context manager handles scope (thread-local vs global)

### Step 6: Generate Reports

Execution results are collected into `StepResult[]` → `report-generator.ts` produces reports in requested formats.

---

## 15. Testing Strategy

### API Unit Tests (Vitest)

**Location:** `apps/api/src/__tests__/*.test.ts`

**Config:** globals enabled (no `import { describe, it, expect }`), 30s timeout, node environment.

**Test files:**
- `ai-service.test.ts` — AI code generation
- `rag-service.test.ts` — RAG indexing and search
- `execution.test.ts` — Code execution flow
- `execution-with-dependencies.test.ts` — Dependency installation
- `docker-cleanup.test.ts` — Container lifecycle
- `docker-integration.test.ts` — K8s integration
- `node-types.test.ts` — Node type validation
- `tree-execution-order.test.ts` — Tree traversal order
- `complex-tree-integration.test.ts` — Complex plan execution
- `dependency-installation.test.ts` — Language-specific deps

**Run single test:**
```bash
cd apps/api && npx vitest run src/__tests__/ai-service.test.ts
```

### Node Integration Tests (Custom Framework)

**Location:** `tests/framework/`

185 tests across 15 test-case files validating all node types against a running API server.

**Suites:**
- `smoke` — Quick validation of core functionality
- `full` — All 185 tests
- `samplers` — HTTP, JDBC, GraphQL, gRPC, etc.
- `controllers` — Loop, while, if, switch, transaction, etc.
- `assertions` — Response, JSON, schema, XPath, duration, etc.
- `http` — HTTP-specific tests
- `timers`, `extractors`, `containers`, `database`, `variables`, `chaining`

**Test runner features:**
- Parallel execution with configurable `maxConcurrency`
- Dependency ordering via topological sort
- Retry with exponential backoff (`retryCount`, `retryDelay`)
- Expected output pattern matching
- Coverage calculation across all node types

### Frontend Tests

Angular tests using the standard `ng test` runner. Test files co-located as `*.spec.ts` next to components and services.

---

## 16. Security Model

### Authentication

- **JWT**: HS256 tokens with configurable expiry. Refresh token support. Token revocation via database table.
- **API Keys**: Generated with `crypto.randomBytes(32)`, stored hashed. Scoped by role.
- **Roles**: `admin` (full access), `user` (standard access), `viewer` (read-only).
- **Dev bypass**: `AUTH_SKIP_IN_DEV=true` injects a dev admin user (never use in production).

### Transport Security

- TLS/HTTPS support via config (`TLS_ENABLED`, cert/key paths)
- CORS configured with explicit origin allowlist
- Security headers: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff

### Execution Isolation

- Runner containers use non-root user (UID 1000)
- Read-only root filesystem
- Resource limits enforced (CPU/memory)
- Network policies can restrict runner egress
- No privilege escalation (`allowPrivilegeEscalation: false`)
- emptyDir volumes for code/output (ephemeral)

### Data Protection

- Sensitive variables encrypted with AES-256-GCM in context manager
- Password hashing via `crypto.scrypt` with random salt
- Report generator masks sensitive data patterns before export
- Connection passwords encrypted at rest in context

### Input Validation

- All API inputs validated with Zod schemas
- Regex operations use `safe-regex.ts` to prevent ReDoS
- SSRF protection on AI proxy endpoints
- URL validation blocks private IP ranges

### Rate Limiting

- Global rate limiter via Fastify plugin
- Stricter limits on AI endpoints (`AI_MAX_REQUESTS` / `AI_WINDOW_MS`)
- Per-user rate limit keys (`ai:{userId}`)

---

## 17. Configuration Reference

All configuration is in `apps/api/src/config/index.ts`, loaded from environment variables.

### Server

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | Environment |
| `CORS_ORIGIN` | `http://localhost:4200` | Allowed CORS origins (comma-separated) |

### TLS

| Env Var | Default | Description |
|---------|---------|-------------|
| `TLS_ENABLED` | `false` | Enable HTTPS |
| `TLS_CERT_PATH` | — | Path to TLS certificate |
| `TLS_KEY_PATH` | — | Path to TLS private key |
| `TLS_CA_PATH` | — | Path to CA certificate (optional) |

### Authentication

| Env Var | Default | Description |
|---------|---------|-------------|
| `JWT_SECRET` | auto-generated in dev | HS256 signing secret |
| `JWT_EXPIRY_SECONDS` | `86400` (24h) | Token TTL |
| `AUTH_SKIP_IN_DEV` | `false` | Skip auth in development |

### Database

| Env Var | Default | Description |
|---------|---------|-------------|
| `DB_HOST` | `localhost` | YugabyteDB host |
| `DB_PORT` | `5433` | YugabyteDB YSQL port |
| `DB_NAME` | `testcraft` | Database name |
| `DB_USER` | `yugabyte` | Database user |
| `DB_PASSWORD` | `yugabyte` | Database password |
| `DB_SSL` | `false` | Enable SSL |
| `DB_POOL_SIZE` | `20` | Connection pool size |

### Kubernetes

| Env Var | Default | Description |
|---------|---------|-------------|
| `K8S_NAMESPACE` | `testcraft-runners` | Runner namespace |
| `K8S_IN_CLUSTER` | `false` | Use in-cluster config |
| `KUBECONFIG` | `~/.kube/config` | Kubeconfig path |

### AI

| Env Var | Default | Description |
|---------|---------|-------------|
| `AI_API_KEY` | — | AI provider API key |
| `AI_BASE_URL` | `https://api.anthropic.com` | AI API base URL |
| `AI_MODEL` | `claude-sonnet-4-5-20250929` | Default model |
| `AI_EMBEDDING_MODEL` | — | Embedding model |

### Rate Limiting

| Env Var | Default | Description |
|---------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_GLOBAL_MAX_REQUESTS` | `100` | Global requests per window |
| `RATE_LIMIT_GLOBAL_WINDOW_MS` | `60000` | Global window (ms) |
| `RATE_LIMIT_AI_MAX_REQUESTS` | `20` | AI requests per window |
| `RATE_LIMIT_AI_WINDOW_MS` | `60000` | AI window (ms) |

### Execution

| Env Var | Default | Description |
|---------|---------|-------------|
| `EXECUTION_MAX_TIMEOUT` | `300` | Max execution timeout (sec) |
| `EXECUTION_DEFAULT_TIMEOUT` | `60` | Default execution timeout (sec) |

### Logging

| Env Var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `info` | Pino log level |
| `LOG_FORMAT` | `pretty` | `pretty` or `json` |

### Metrics

| Env Var | Default | Description |
|---------|---------|-------------|
| `METRICS_ENABLED` | `true` | Enable metrics collection |
| `METRICS_PATH` | `/metrics` | Prometheus scrape path |

---

## 18. Code Conventions & Patterns

### ESM Imports

Always use `.js` extension even for TypeScript files:

```typescript
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';
import type { FastifyInstance } from 'fastify';
```

### Logger

```typescript
import { logger } from '../../common/logger.js';  // NOT ../logging/logger

logger.info({ key: 'value' }, 'Message');
logger.error({ err }, 'Something failed');
logger.debug({ phase: 'FIND_POD' }, 'Looking for warm pod');
```

### Error Handling

```typescript
import { AppError } from '../../common/error-handler.js';

// Throw typed errors:
throw AppError.badRequest('Invalid language');
throw AppError.notFound('Execution not found');
throw AppError.unauthorized('Token expired');

// In routes:
try {
  const result = await doSomething();
  return result;
} catch (err) {
  logger.error({ err }, 'Operation failed');
  throw err; // Error handler plugin formats the response
}
```

### Route Module Pattern

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  language: z.enum(['java', 'python', ...]),
});

export async function myRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: z.infer<typeof CreateSchema> }>('/', async (request, reply) => {
    const body = CreateSchema.parse(request.body);
    // ...
    return reply.status(201).send(result);
  });
}
```

### Type-Only Imports

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { NodeType, TreeNode, ExecutionResult } from '@testcraft/shared-types';
```

### Shared Types Rule

**CRITICAL:** All types live in `packages/shared-types/src/nodes.ts`. The `index.ts` only does `export *`. Never add types to `index.ts`. When adding a new node type:

1. Add to the `NodeType` union in `nodes.ts`
2. Add to the appropriate `NODE_CATEGORIES` array
3. Create a config interface extending `BaseNodeConfig`
4. Add to the `NodeConfig` union type
5. Add to `LANGUAGE_INFO` if it's a new language

### Angular Conventions

- Standalone components (no NgModules)
- Signals for state, `computed()` for derived state
- `inject()` instead of constructor injection
- PrimeNG components for UI elements
- CSS custom properties for theming (`--tc-primary`, `--tc-bg-*`, `--tc-text-*`, `--tc-spacing-*`)

### Prettier

```json
{ "printWidth": 100, "singleQuote": true }
```

### Constants

Magic numbers go in `apps/api/src/common/constants.ts` under the appropriate category object (`EXECUTION_CONSTANTS`, `AI_CONSTANTS`, `K8S_CONSTANTS`, etc.). Environment-driven values go in `config/index.ts`.

---

## 19. Common Tasks for Agents

### Adding a New Node Type

1. **shared-types** (`nodes.ts`):
   - Add to `NodeType` union
   - Add to `NODE_CATEGORIES.<category>` array
   - Create `MyNewNodeConfig extends BaseNodeConfig` interface
   - Add to `NodeConfig` union

2. **API testing** (`modules/testing/routes.ts`):
   - Add handler in the node type switch/if chain

3. **Web UI** (`features/editor/components/node-config/`):
   - Add `@case` block in `NodeConfigPanelComponent` template
   - Add metadata to `NodeRegistryService`

4. **Tests** (`tests/framework/test-cases/`):
   - Add test cases in the appropriate test file

### Adding a New API Endpoint

1. Create or modify `apps/api/src/modules/<module>/routes.ts`
2. Define Zod schema for request validation
3. Export the routes function
4. Register in `main.ts` with appropriate prefix
5. Add tests in `apps/api/src/__tests__/`

### Adding a New Language Runner

1. Create `docker/runners/<language>/Dockerfile` + `runner.sh`
2. Add to `SupportedLanguage` type in `nodes.ts`
3. Add to `LANGUAGE_INFO` map in `nodes.ts`
4. Add to `SUPPORTED_LANGUAGES` in `constants.ts`
5. Add runner image to `k8s/base/configmap.yaml`
6. Add deployment to `k8s/runners/`
7. Add to `k8s/kustomization.yaml` images list
8. Add to `docker-compose.yaml` (under `runners` profile)
9. Add sample code in `tests/samples/<language>.txt`

### Adding a New Report Format

1. Add to `ReportFormat` type in `modules/reporting/types.ts`
2. Add generator method in `report-generator.ts`
3. Add format option in reporting routes

### Working with the Database

```bash
# Start local YugabyteDB
docker compose up -d yugabyte

# Run migrations
cd apps/api && npm run migrate

# Check migration status
cd apps/api && npm run migrate:status

# Rollback last migration
cd apps/api && npm run migrate:rollback

# Connect directly (ysqlsh or psql on port 5433)
psql -h localhost -p 5433 -U yugabyte -d testcraft
```

### Running the Full Stack Locally

```bash
# Option 1: Python orchestrator
python3 start.py

# Option 2: Manual
docker compose up -d yugabyte          # Start DB
npm run start:api                       # Terminal 1: API on :3000
npm run start:web                       # Terminal 2: Frontend on :4200

# Option 3: With K8s runners
make k8s-deploy-all                     # Deploy everything to Kind cluster
```

---

*This document reflects the codebase as of 2026-02-07. Update it when making significant architectural changes.*
