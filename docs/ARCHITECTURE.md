# TestCraft Architecture

## Overview

TestCraft is a Kubernetes-based test execution platform that supports running tests in multiple programming languages with AI-powered features, HOCON-based test plan configuration, and comprehensive reporting.

## Core Principles

1. **Language Agnostic**: Support any programming language through containerized runners
2. **Declarative Tests**: HOCON-based test plans for human-readable configuration
3. **AI-Enhanced**: AI nodes for test generation, data generation, and validation
4. **Context-Aware**: Secure variable passing and metrics collection across test steps
5. **CI/CD Native**: First-class support for Jenkins, GitHub Actions, and other CI systems

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TestCraft Platform                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │  CLI Tool   │    │   REST API   │    │  WebSocket  │                  │
│  │ (testcraft) │    │   (Fastify)  │    │   Streams   │                  │
│  └──────┬──────┘    └──────┬───────┘    └──────┬──────┘                  │
│         │                  │                    │                         │
│         └──────────────────┼────────────────────┘                         │
│                            │                                              │
│  ┌─────────────────────────┴─────────────────────────┐                   │
│  │                   Core Services                     │                   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │                   │
│  │  │  HOCON  │  │ Context │  │Reporting│  │   AI   │ │                   │
│  │  │ Parser  │  │ Manager │  │ Engine  │  │Service │ │                   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └───┬────┘ │                   │
│  └───────┼────────────┼───────────┼────────────┼──────┘                   │
│          │            │           │            │                          │
│  ┌───────┴────────────┴───────────┴────────────┴──────┐                   │
│  │              Execution Orchestrator                 │                   │
│  │         (Kubernetes Pod Management)                 │                   │
│  └───────────────────────┬────────────────────────────┘                   │
│                          │                                                │
├──────────────────────────┼────────────────────────────────────────────────┤
│                          │                                                │
│  ┌───────────────────────┴────────────────────────────┐                   │
│  │                 Kubernetes Cluster                  │                   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │                   │
│  │  │  Python  │ │   Java   │ │    Go    │ │  ...   │ │                   │
│  │  │  Runner  │ │  Runner  │ │  Runner  │ │Runners │ │                   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │                   │
│  └────────────────────────────────────────────────────┘                   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                          Data Layer                                       │
│  ┌─────────────────┐    ┌─────────────────┐                              │
│  │   YugabyteDB    │    │   Vector Store  │                              │
│  │  (PostgreSQL)   │    │   (pgvector)    │                              │
│  └─────────────────┘    └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
TestCraftAI/
├── apps/
│   ├── api/                    # Backend API server
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── ai/         # AI services (RAG, generation)
│   │       │   ├── containers/ # Kubernetes orchestration
│   │       │   ├── context/    # Execution context & services
│   │       │   ├── database/   # YugabyteDB client
│   │       │   ├── execution/  # Test execution engine
│   │       │   ├── health/     # Health check endpoints
│   │       │   ├── hocon/      # HOCON parser & storage
│   │       │   ├── logging/    # Structured logging
│   │       │   └── reporting/  # Report generation
│   │       └── main.ts
│   └── cli/                    # CLI tool
│       └── src/
│           ├── commands/       # CLI commands
│           └── index.ts
├── docker/
│   └── runners/               # Language runner images
│       ├── java/
│       ├── python/
│       ├── csharp/
│       └── ...
├── k8s/                       # Kubernetes manifests
│   ├── base/
│   └── runners/
├── packages/
│   └── shared-types/          # Shared TypeScript types
│       └── src/
│           ├── nodes.ts       # Node type definitions
│           └── hocon-schema.ts
├── tests/                     # Example test plans
│   ├── smoke-tests.hocon
│   ├── integration-tests.hocon
│   └── ...
├── jenkins/                   # Jenkins integration
└── docs/                      # Documentation
```

## Component Details

### 1. HOCON Parser (`apps/api/src/modules/hocon/`)

Handles parsing and serialization of HOCON test plans.

**Key Files:**
- `parser.ts` - HOCON parsing and validation
- `storage.ts` - Test plan persistence
- `routes.ts` - REST API endpoints

**Features:**
- Parse HOCON syntax with variable substitution
- Validate test plan structure
- Store/retrieve plans with versioning
- Export to HOCON format

### 2. Context Manager (`apps/api/src/modules/context/`)

Manages execution state, variables, and database connections.

**Key Files:**
- `context-manager.ts` - Core context management
- `context-service.ts` - Background services for metrics
- `routes.ts` - REST API endpoints

**Features:**
- Variable scoping (global, plan, node, thread)
- AES-256 encryption for sensitive data
- Database connection management
- Code injection for multiple languages
- Background metrics collection services

### 3. Reporting Engine (`apps/api/src/modules/reporting/`)

Generates test reports in multiple formats.

**Key Files:**
- `types.ts` - Report type definitions
- `junit-reporter.ts` - JUnit XML generation
- `html-reporter.ts` - Interactive HTML reports
- `report-generator.ts` - Main orchestrator
- `routes.ts` - REST API endpoints

**Supported Formats:**
- JUnit XML (CI/CD compatible)
- HTML (interactive with charts)
- JSON (programmatic access)
- Markdown (documentation)
- CSV (spreadsheet export)

### 4. AI Services (`apps/api/src/modules/ai/`)

AI-powered features for test enhancement.

**Key Files:**
- `ai-service.ts` - AI generation and validation
- `rag-service.ts` - RAG with vector search
- `routes.ts` - REST API endpoints

**Features:**
- Test case generation
- Test data generation
- Response validation
- Anomaly detection
- Vector similarity search (RAG)

### 5. Execution Orchestrator (`apps/api/src/modules/containers/`)

Kubernetes-based code execution.

**Key Files:**
- `k8s-client.ts` - Kubernetes API wrapper
- `orchestrator.ts` - Pod management
- `routes.ts` - REST API endpoints

**Features:**
- Warm pool pods for fast execution
- Multi-language support (10+ languages)
- Resource limits and quotas
- Execution isolation

### 6. Logging System (`apps/api/src/modules/logging/`)

Structured logging with security features.

**Key Files:**
- `logger.ts` - Logger implementation

**Features:**
- Log levels (trace, debug, info, warn, error, fatal)
- Automatic sensitive data masking
- Structured JSON output
- File rotation
- Export capabilities

## API Endpoints

### Test Plans
```
POST   /api/v1/plans/import              # Import HOCON plan
GET    /api/v1/plans/:id/export          # Export to HOCON
GET    /api/v1/plans                     # List plans
GET    /api/v1/plans/:id                 # Get plan details
PUT    /api/v1/plans/:id                 # Update plan
DELETE /api/v1/plans/:id                 # Delete plan
POST   /api/v1/plans/validate            # Validate HOCON
POST   /api/v1/plans/execute             # Execute plan
```

### Context Management
```
POST   /api/v1/executions/:id/context              # Create context
GET    /api/v1/executions/:id/context              # Get context
POST   /api/v1/executions/:id/context/variables    # Set variable
GET    /api/v1/executions/:id/context/variables    # Get variables
POST   /api/v1/executions/:id/context/connections  # Register DB connection
POST   /api/v1/executions/:id/context/code-injection # Generate code
GET    /api/v1/executions/:id/context/logs         # Get logs
```

### Reporting
```
GET    /api/v1/executions/:id/report     # Generate report
POST   /api/v1/executions/:id/reports    # Generate multiple formats
GET    /api/v1/executions/:id/summary    # Quick summary
POST   /api/v1/executions/:id/steps      # Record step result
POST   /api/v1/executions/:id/start      # Start recording
POST   /api/v1/executions/:id/complete   # Complete recording
```

### AI Services
```
POST   /api/v1/ai/generate-tests         # Generate test cases
POST   /api/v1/ai/generate-data          # Generate test data
POST   /api/v1/ai/validate               # Validate response
POST   /api/v1/ai/search                 # RAG search
```

## Node Types

See `packages/shared-types/src/nodes.ts` for the complete list of 80+ node types.

### Categories:
1. **Core** - root, thread-group, setup/teardown
2. **Samplers** - HTTP, JDBC, GraphQL, gRPC, WebSocket, Kafka, MongoDB, Redis
3. **Controllers** - Loop, While, ForEach, If, Switch, Transaction
4. **Timers** - Constant, Uniform Random, Gaussian, Poisson
5. **Assertions** - Response, JSON, XPath, Duration, Size
6. **Extractors** - JSON Path, XPath, Regex, Boundary
7. **Pre/Post Processors** - JSR223, BeanShell, User Parameters
8. **Listeners** - View Results, Summary, Aggregate
9. **Config** - HTTP Defaults, CSV Data, User Variables
10. **AI Nodes** - Test Generator, Data Generator, Validator, Anomaly Detector

## Security Features

1. **Encryption**: AES-256-GCM for sensitive data
2. **Masking**: Automatic log sanitization
3. **Isolation**: Kubernetes pod isolation
4. **RBAC**: Kubernetes service accounts

## CI/CD Integration

### Jenkins
- Jenkinsfile template
- Shared library (`testcraft.groovy`)
- Multibranch pipeline support

### GitHub Actions
- Workflow template (`.github/workflows/testcraft.yml`)
- Matrix testing support
- Artifact publishing

## Database Schema

YugabyteDB with pgvector extension for:
- Test plan storage
- Execution history
- Vector embeddings for RAG
- Metrics time series
