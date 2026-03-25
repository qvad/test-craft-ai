# TestCraft Development Guide

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Kubernetes cluster (minikube/kind for local development)
- kubectl configured

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/testcraft.git
cd testcraft

# Install dependencies
npm install

# Start infrastructure (YugabyteDB)
docker-compose up -d

# Apply Kubernetes manifests (for runner pods)
kubectl apply -k k8s/

# Start the API server
npm run dev --workspace=apps/api

# In another terminal, build the CLI
npm run build --workspace=apps/cli
```

### Project Structure

```
TestCraftAI/
├── apps/
│   ├── api/              # Backend API (Fastify)
│   └── cli/              # CLI tool (Commander.js)
├── packages/
│   └── shared-types/     # Shared TypeScript definitions
├── docker/
│   └── runners/          # Language runner Dockerfiles
├── k8s/                  # Kubernetes manifests
├── tests/                # Example test plans
├── jenkins/              # Jenkins integration
├── docs/                 # Documentation
└── docker-compose.yaml   # Local infrastructure
```

---

## Architecture Overview

### Core Components

1. **API Server** (`apps/api/`) - Fastify-based REST API
2. **CLI Tool** (`apps/cli/`) - Command-line interface
3. **Shared Types** (`packages/shared-types/`) - TypeScript definitions
4. **Runners** (`docker/runners/`) - Language-specific Docker images
5. **Kubernetes** (`k8s/`) - Deployment manifests

### Module Structure

Each module in `apps/api/src/modules/` follows this pattern:

```
module-name/
├── index.ts          # Exports
├── routes.ts         # API routes
├── service.ts        # Business logic (optional)
├── types.ts          # Type definitions (optional)
└── *.test.ts         # Tests
```

---

## Adding New Features

### Checklist

Before adding a feature:

1. [ ] Check `docs/FEATURES.md` for existing capabilities
2. [ ] Check `docs/ARCHITECTURE.md` for system design
3. [ ] Review related code in `apps/api/src/modules/`
4. [ ] Plan integration with existing systems

### Adding a New Node Type

1. **Define the node type** in `packages/shared-types/src/nodes.ts`:

```typescript
// Add to appropriate category
export const NODE_TYPES = {
  // ...existing types
  samplers: [
    // ...
    'new-sampler-type',
  ],
};

// Add configuration interface
export interface NewSamplerConfig {
  param1: string;
  param2?: number;
}
```

2. **Implement the executor** in `apps/api/src/modules/execution/`:

```typescript
// executors/new-sampler.ts
export async function executeNewSampler(
  node: TestNode,
  context: ExecutionContextManager
): Promise<StepResult> {
  const config = node.config as NewSamplerConfig;

  // Implementation
  const startTime = new Date();
  try {
    // Execute the sampler logic
    const result = await performAction(config);

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      status: 'passed',
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      assertions: [],
      metrics: { startTime },
      logs: [],
    };
  } catch (error) {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      status: 'error',
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      assertions: [],
      error: { message: error.message, stack: error.stack },
      metrics: { startTime },
      logs: [],
    };
  }
}
```

3. **Register the executor** in the execution engine.

4. **Document** in `docs/HOCON-REFERENCE.md`:

```hocon
### New Sampler Type

\`\`\`hocon
{
  id = "new-sampler-1"
  type = "new-sampler-type"
  name = "My New Sampler"
  config {
    param1 = "value"
    param2 = 42
  }
}
\`\`\`
```

5. **Update `docs/FEATURES.md`** if it's a major feature.

### Adding a New API Endpoint

1. Create or update routes file in the appropriate module:

```typescript
// apps/api/src/modules/my-feature/routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function myFeatureRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/my-endpoint', async (request, reply) => {
    // Implementation
  });
}
```

2. Register in `apps/api/src/main.ts`:

```typescript
import { myFeatureRoutes } from './modules/my-feature/routes.js';

// In start():
await app.register(myFeatureRoutes, { prefix: '/api/v1/my-feature' });
```

3. Document in `docs/API-REFERENCE.md`.

### Adding a New CLI Command

1. Create command file:

```typescript
// apps/cli/src/commands/my-command.ts
import chalk from 'chalk';
import ora from 'ora';

interface MyCommandOptions {
  option1?: string;
}

export async function myCommand(arg: string, options: MyCommandOptions): Promise<void> {
  const spinner = ora('Processing...').start();

  try {
    // Implementation
    spinner.succeed(chalk.green('Done!'));
  } catch (err) {
    spinner.fail(chalk.red('Failed'));
    console.error(err);
    process.exit(1);
  }
}
```

2. Register in `apps/cli/src/index.ts`:

```typescript
import { myCommand } from './commands/my-command';

program
  .command('my-command <arg>')
  .description('Description of my command')
  .option('-o, --option1 <value>', 'Option description')
  .action(myCommand);
```

3. Document in `docs/CLI-REFERENCE.md`.

### Adding a New Language Runner

1. Create directory structure:

```
docker/runners/newlang/
├── Dockerfile
├── runner.sh
└── dependencies.txt (or equivalent)
```

2. Create Dockerfile:

```dockerfile
FROM newlang:latest

WORKDIR /app

# Install dependencies
COPY dependencies.txt .
RUN install-deps dependencies.txt

# Copy runner script
COPY runner.sh /runner.sh
RUN chmod +x /runner.sh

CMD ["sleep", "infinity"]
```

3. Create runner script:

```bash
#!/bin/bash
# runner.sh

CODE_FILE=$1
TIMEOUT=${2:-60}

# Execute with timeout
timeout $TIMEOUT newlang $CODE_FILE
```

4. Add Kubernetes manifest:

```yaml
# k8s/runners/newlang-runner.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: newlang-runner
  namespace: testcraft-runners
spec:
  replicas: 2
  selector:
    matchLabels:
      app: newlang-runner
  template:
    metadata:
      labels:
        app: newlang-runner
        language: newlang
    spec:
      containers:
      - name: runner
        image: testcraft/runner-newlang:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

5. Update kustomization.yaml.

6. Update `apps/api/src/modules/containers/orchestrator.ts` to support the new language.

7. Document in `docs/FEATURES.md`.

---

## Testing

### Node Type Test Framework

TestCraftAI includes a comprehensive test framework for validating all 100 node types. The framework is located in `tests/framework/`.

#### Running Node Tests

```bash
# Run smoke tests (quick validation)
npm run test:smoke

# Run full test suite (all 166 tests)
npm run test:full

# Run specific categories
npm run test:samplers
npm run test:controllers
npm run test:assertions
npm run test:http
```

#### Test Coverage

The test suite covers **100 node types** across these categories:

| Category | Node Types | Tests |
|----------|------------|-------|
| Samplers | http-request, graphql-request, jdbc-request, grpc-request, websocket-request, kafka-producer/consumer, mongodb-request, tcp, smtp, ftp, ldap, jms, shell-command, script-sampler | 30+ |
| Controllers | loop, while, foreach, if, switch, transaction, throughput, parallel, runtime, interleave, random, once-only, module, include | 20+ |
| Timers | constant, uniform-random, gaussian-random, poisson-random, constant-throughput, synchronizing, precise-throughput | 10+ |
| Assertions | response, json, json-schema, duration, size, xpath, md5, compare, html, xml, jsr223, beanshell | 20+ |
| Extractors | json, regex, css, xpath, boundary | 10+ |
| Config Elements | http-defaults, http-header-manager, http-cookie-manager, jdbc-connection, csv-data-set, counter, random-variable, user-defined-variables, dns-cache-manager | 15+ |
| Preprocessors/Postprocessors | user-parameters, html-link-parser, jsr223-preprocessor/postprocessor, beanshell-preprocessor/postprocessor | 10+ |
| Listeners | view-results-tree, summary-report, aggregate-report, backend-listener, simple-data-writer | 5 |
| Thread Groups | root, thread-group, setup-thread-group, teardown-thread-group | 5 |
| AI Nodes | ai-test-generator, ai-data-generator, ai-response-validator, ai-load-predictor, ai-anomaly-detector, ai-scenario-builder, ai-assertion, ai-extractor, ai-script | 9 |
| Containers | docker-run, k8s-deploy, k8s-pod | 10 |
| Database | yugabyte-request, postgresql-request, database-request | 6 |

#### Infrastructure-Dependent Tests

Six node types require external infrastructure and are **skipped by default** when infrastructure is unavailable:

| Node Type | Requirement | Skip Flag |
|-----------|-------------|-----------|
| `docker-run` | Docker daemon | `SKIP_DOCKER_TESTS=true` |
| `k8s-deploy`, `k8s-pod` | Kubernetes cluster | `SKIP_K8S_TESTS=true` |
| `yugabyte-request`, `postgresql-request`, `database-request` | YugabyteDB | `SKIP_DB_TESTS=true` |
| `websocket-request` | External WebSocket server | `SKIP_WEBSOCKET_TESTS=true` |

**Running with full infrastructure:**

```bash
# Start infrastructure
docker-compose up -d

# Run all tests including infrastructure-dependent ones
npm run test:full
```

**The tests and handlers exist and are fully implemented** - they are only skipped when the required services are not available. When running with Docker, Kubernetes, and YugabyteDB available, coverage is 100%.

#### Test Structure

```
tests/framework/
├── index.ts                    # Test suite entry point
├── test-runner.ts              # Test execution engine
└── test-cases/
    ├── sampler-tests.ts        # HTTP, GraphQL, Shell, Script samplers
    ├── controller-tests.ts     # Loop, If, While, ForEach, etc.
    ├── assertion-extractor-tests.ts  # Response, JSON, Schema assertions
    ├── container-tests.ts      # Docker and Kubernetes tests
    ├── database-tests.ts       # YugabyteDB/PostgreSQL tests
    ├── variable-substitution-tests.ts  # ${variable} substitution
    ├── thread-group-tests.ts   # Root and thread group tests
    ├── config-element-tests.ts # HTTP defaults, CSV, Counter, etc.
    ├── preprocessor-postprocessor-tests.ts  # Pre/post processors
    ├── more-assertion-tests.ts # XPath, MD5, HTML, XML assertions
    ├── more-controller-tests.ts # Runtime, Random, Module controllers
    ├── listener-tests.ts       # Result listeners
    ├── more-sampler-tests.ts   # JDBC, TCP, SMTP, Kafka, etc.
    └── ai-node-tests.ts        # AI-powered nodes
```

#### Adding a New Node Type Test

```typescript
// tests/framework/test-cases/my-tests.ts
import type { TestCase } from '../test-runner';

export const myTests: TestCase[] = [
  {
    id: 'my-node-basic',
    name: 'My Node - Basic Test',
    description: 'Test basic functionality',
    nodeType: 'my-node-type',
    category: 'samplers',
    config: {
      type: 'my-node-type',
      param1: 'value',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['my-node', 'basic'],
    skip: process.env.SKIP_MY_TESTS === 'true',  // Optional skip flag
  },
];

export default myTests;
```

Then register in `tests/framework/index.ts`:

```typescript
import myTests from './test-cases/my-tests';

const allTests = [
  // ...existing tests
  ...myTests,
];
```

---

### Unit Tests

Use Vitest for unit testing:

```bash
# Run all tests
npm test

# Run specific workspace tests
npm test --workspace=apps/api

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Writing Unit Tests

Use Vitest for testing:

```typescript
// my-feature.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyFeature } from './my-feature';

describe('MyFeature', () => {
  let feature: MyFeature;

  beforeEach(() => {
    feature = new MyFeature();
  });

  it('should do something', () => {
    const result = feature.doSomething();
    expect(result).toBe('expected');
  });

  it('should handle errors', async () => {
    await expect(feature.failingMethod()).rejects.toThrow('Expected error');
  });
});
```

### Test Naming Conventions

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

---

## Code Style

### TypeScript

- Use strict mode
- Explicit return types for public functions
- Interfaces for object shapes
- Enums for fixed sets of values

```typescript
// Good
export interface UserConfig {
  name: string;
  timeout?: number;
}

export function createUser(config: UserConfig): User {
  // ...
}

// Avoid
export function createUser(config: any) {
  // ...
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `context-manager.ts` |
| Classes | PascalCase | `ExecutionContextManager` |
| Functions | camelCase | `getVariable()` |
| Constants | SCREAMING_SNAKE | `MAX_TIMEOUT` |
| Interfaces | PascalCase, no `I` prefix | `UserConfig` |
| Types | PascalCase | `VariableScope` |

### Comments

- Use JSDoc for public APIs
- Inline comments for complex logic
- TODO format: `// TODO: description`

```typescript
/**
 * Execute a test node and return the result.
 *
 * @param node - The node to execute
 * @param context - Execution context with variables and connections
 * @returns The step result with status, assertions, and metrics
 */
export async function executeNode(
  node: TestNode,
  context: ExecutionContextManager
): Promise<StepResult> {
  // ...
}
```

---

## Documentation Updates

When making changes, update the relevant documentation:

| Change Type | Update |
|-------------|--------|
| New feature | `docs/FEATURES.md` |
| New node type | `docs/HOCON-REFERENCE.md` |
| New API endpoint | `docs/API-REFERENCE.md` |
| New CLI command | `docs/CLI-REFERENCE.md` |
| Architecture change | `docs/ARCHITECTURE.md` |
| New language runner | `docs/FEATURES.md` |

---

## Debugging

### API Server

```bash
# Run with debug logging
DEBUG=testcraft:* npm run dev --workspace=apps/api

# Or set in environment
export LOG_LEVEL=debug
```

### Kubernetes Pods

```bash
# View runner pod logs
kubectl logs -n testcraft-runners -l language=python -f

# Exec into a runner pod
kubectl exec -it -n testcraft-runners <pod-name> -- /bin/bash

# View pod status
kubectl get pods -n testcraft-runners -w
```

### Database

```bash
# Connect to YugabyteDB
docker exec -it yugabyte-db ysqlsh -h localhost -U yugabyte

# View tables
\dt

# Query execution data
SELECT * FROM executions ORDER BY created_at DESC LIMIT 10;
```

---

## Release Process

1. Update version in `package.json` files
2. Update `CHANGELOG.md`
3. Create git tag
4. Build and publish Docker images
5. Publish npm packages

```bash
# Tag release
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# Build and push Docker images
docker build -t testcraft/api:v1.2.0 -f apps/api/Dockerfile .
docker push testcraft/api:v1.2.0

# Publish CLI
npm publish --workspace=apps/cli
```

---

## Getting Help

- Check existing documentation in `docs/`
- Search existing issues
- Create a new issue with:
  - Clear description
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details
