# TestCraft Features

## Table of Contents

1. [HOCON Test Plans](#hocon-test-plans)
2. [Context Management](#context-management)
3. [Reporting System](#reporting-system)
4. [AI Features](#ai-features)
5. [Multi-Language Execution](#multi-language-execution)
6. [CI/CD Integration](#cicd-integration)
7. [Metrics & Monitoring](#metrics--monitoring)

---

## HOCON Test Plans

### Overview

Test plans are defined in HOCON (Human-Optimized Config Object Notation) format, providing a readable, version-control friendly way to define tests.

### Structure

```hocon
testcraft {
  plan {
    name = "My Test Plan"
    description = "Description of the test"
    version = "1.0"
    tags = ["api", "integration"]

    config {
      timeout = 300000
      parallelExecution = true
      stopOnError = false
    }

    variables {
      baseUrl = ${?BASE_URL} "https://api.example.com"
    }

    secrets {
      apiKey = ${?API_KEY}
    }

    nodes = [
      {
        id = "step-1"
        type = "http-request"
        name = "API Health Check"
        config { ... }
        assertions = [ ... ]
      }
    ]
  }
}
```

### Key Features

- **Variable Substitution**: Use `${variable}` or `${?OPTIONAL}`
- **Environment Variables**: Reference with `${env.VAR_NAME}`
- **Includes**: Split plans with `include "other-file.hocon"`
- **Comments**: Support for `//` and `/* */` comments

### Location
- `apps/api/src/modules/hocon/parser.ts`
- `packages/shared-types/src/hocon-schema.ts`

---

## Context Management

### Overview

The context system provides secure variable storage, database connection management, and state sharing across test steps.

### Variable Scopes

| Scope | Description | Use Case |
|-------|-------------|----------|
| `global` | Persists across all plans | Shared configuration |
| `plan` | Persists within a plan execution | Test data |
| `node` | Scoped to a single node | Temporary values |
| `thread` | Scoped to a thread in parallel execution | Thread-local data |

### Code Example

```typescript
// Set a variable
context.setVariable('userId', '12345', {
  scope: 'plan',
  sensitive: false,
});

// Set a sensitive variable (encrypted)
context.setVariable('authToken', 'secret-token', {
  scope: 'plan',
  sensitive: true,  // Will be encrypted with AES-256
});

// Register a database connection
const connectionId = context.registerConnection({
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',  // Stored encrypted
});

// Generate code injection for Python
const code = context.generateCodeInjection('python', ['userId'], [connectionId]);
```

### Supported Languages for Code Injection

- Python
- JavaScript/TypeScript
- Java
- C#
- Go
- Ruby

### Location
- `apps/api/src/modules/context/context-manager.ts`
- `apps/api/src/modules/context/routes.ts`

---

## Reporting System

### Overview

Comprehensive reporting with multiple output formats, designed for CI/CD integration.

### Report Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| JUnit XML | `.xml` | CI/CD systems (Jenkins, GitHub Actions) |
| HTML | `.html` | Human-readable with charts |
| JSON | `.json` | Programmatic access |
| Markdown | `.md` | Documentation |
| CSV | `.csv` | Spreadsheet analysis |

### JUnit Report Features

- Compatible with all major CI systems
- Step-level test cases
- Assertions as individual tests
- System output/error capture
- Properties for metadata

### HTML Report Features

- Interactive step expansion
- Performance charts (Chart.js)
- Timeline visualization
- Log viewer with syntax highlighting
- Service metrics display
- Dark/light theme support

### Report API

```bash
# Generate single format
GET /api/v1/executions/{id}/report?format=junit

# Generate multiple formats
POST /api/v1/executions/{id}/reports
{
  "formats": ["junit", "html", "json"]
}
```

### Location
- `apps/api/src/modules/reporting/junit-reporter.ts`
- `apps/api/src/modules/reporting/html-reporter.ts`
- `apps/api/src/modules/reporting/report-generator.ts`

---

## AI Features

### Overview

AI-powered nodes enhance testing with automatic generation, validation, and anomaly detection.

### AI Node Types

| Node Type | Description |
|-----------|-------------|
| `ai-test-generator` | Generate test cases from requirements |
| `ai-data-generator` | Generate realistic test data |
| `ai-response-validator` | Validate responses against expectations |
| `ai-load-predictor` | Predict performance under load |
| `ai-anomaly-detector` | Detect unusual patterns |
| `ai-scenario-builder` | Build test scenarios from descriptions |
| `ai-assertion` | Natural language assertions |
| `ai-extractor` | Intelligent data extraction |
| `ai-script` | Generate code snippets |

### RAG (Retrieval-Augmented Generation)

Uses YugabyteDB with pgvector for semantic search:

```typescript
// Index a document
await ragService.indexDocument({
  content: 'API documentation...',
  metadata: { type: 'api-docs' },
});

// Search for relevant content
const results = await ragService.search('authentication endpoint', {
  limit: 5,
  minScore: 0.7,
});
```

### Location
- `apps/api/src/modules/ai/ai-service.ts`
- `apps/api/src/modules/ai/rag-service.ts`
- `packages/shared-types/src/nodes.ts` (AI node definitions)

---

## Multi-Language Execution

### Supported Languages

| Language | Docker Image | Runner |
|----------|--------------|--------|
| Java | `testcraft/runner-java` | JDK 21 |
| Python | `testcraft/runner-python` | Python 3.11 |
| C# | `testcraft/runner-csharp` | .NET 8 |
| JavaScript | `testcraft/runner-javascript` | Node.js 20 |
| TypeScript | `testcraft/runner-typescript` | ts-node |
| Go | `testcraft/runner-go` | Go 1.21 |
| Rust | `testcraft/runner-rust` | Rust 1.73 |
| Ruby | `testcraft/runner-ruby` | Ruby 3.2 |
| PHP | `testcraft/runner-php` | PHP 8.2 |
| Kotlin | `testcraft/runner-kotlin` | Kotlin 1.9 |

### Warm Pool Architecture

Kubernetes maintains warm pods for fast execution:

```yaml
# Deployment creates ready-to-use pods
replicas: 3  # Warm pool size
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
```

### Location
- `docker/runners/` - Dockerfiles
- `k8s/runners/` - Kubernetes manifests
- `apps/api/src/modules/containers/orchestrator.ts`

---

## CI/CD Integration

### Jenkins

**Jenkinsfile:**
```groovy
@Library('testcraft') _

pipeline {
  stages {
    stage('Test') {
      steps {
        testcraft.run(
          plan: 'tests/api-tests.hocon',
          environment: 'staging',
          parallel: true
        )
      }
    }
  }
}
```

**Available Methods:**
- `testcraft.run()` - Execute a test plan
- `testcraft.validate()` - Validate HOCON
- `testcraft.importPlan()` - Import plan to server
- `testcraft.exportPlan()` - Export plan from server
- `testcraft.runParallel()` - Run multiple plans

### GitHub Actions

```yaml
- name: Run TestCraft Tests
  run: |
    npm install -g @testcraft/cli
    testcraft run tests/api-tests.hocon \
      --api-url ${{ secrets.TESTCRAFT_API_URL }} \
      --environment staging \
      --format junit --format html \
      --ci
```

### Location
- `jenkins/Jenkinsfile`
- `jenkins/vars/testcraft.groovy`
- `.github/workflows/testcraft.yml`

---

## Metrics & Monitoring

### Context Services

Background services collect metrics during test execution:

```typescript
// System resource monitor
const systemMonitor = new SystemResourceMonitor(5000);
serviceManager.register(systemMonitor);

// HTTP endpoint monitor
const httpMonitor = new HttpEndpointMonitor({
  endpoints: [
    { name: 'api', url: 'http://api.example.com/health' }
  ],
  interval: 10000,
});
serviceManager.register(httpMonitor);

// Prometheus collector
const prometheusCollector = new PrometheusCollector({
  endpoint: 'http://prometheus:9090',
  queries: [
    { name: 'http_requests_total', query: 'sum(http_requests_total)' }
  ],
});
serviceManager.register(prometheusCollector);

// Start all services
serviceManager.startAll();

// Get metrics snapshot for report
const metrics = serviceManager.getAllSnapshots();
```

### Available Service Types

| Service Type | Description | Metrics Collected |
|--------------|-------------|-------------------|
| `system` | System resources | CPU, memory, event loop lag |
| `prometheus` | Prometheus queries | Custom PromQL queries |
| `http` | HTTP endpoints | Response time, availability |
| `database` | Database health | Query time, connections |
| `custom` | User-defined | Any custom metrics |

### Location
- `apps/api/src/modules/context/context-service.ts`

---

## Logging System

### Features

- Structured JSON logging
- Automatic sensitive data masking
- Log levels: trace, debug, info, warn, error, fatal
- File rotation support
- Export to JSON, CSV, or text

### Masked Patterns

Automatically detects and masks:
- Passwords (`password=xxx`)
- API keys (`api_key=xxx`)
- Tokens (`token=xxx`, `Bearer xxx`)
- Connection strings (`postgresql://user:pass@host`)
- AWS keys (`AKIA...`)
- Credit card numbers
- Private keys

### Usage

```typescript
const logger = new Logger({
  level: 'info',
  json: true,
  file: {
    enabled: true,
    path: '/var/log/testcraft.log',
    maxSize: 10 * 1024 * 1024,
    maxFiles: 5,
  },
});

logger.info('Test started', { executionId: '123' });
logger.error('Test failed', { error: err.message });
```

### Location
- `apps/api/src/modules/logging/logger.ts`
