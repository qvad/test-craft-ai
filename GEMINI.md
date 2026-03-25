# TestCraft AI - Gemini CLI Context

TestCraft AI is a visual test orchestration platform designed as a modern, AI-powered replacement for Apache JMeter. It features a web-based visual editor, AI-driven configuration, and multi-language execution orchestrated via Kubernetes and Docker.

## AI Collaboration & Coding Mandates

- **Coding Tasks**: For all coding tasks, you MUST defer to or consult Claude. It is a mandatory requirement as Claude manages coding tasks more effectively in this environment.
- **Coding Standards**: Always cross-reference instructions in `CLAUDE.md` when analyzing or proposing code changes to ensure alignment with established project conventions.

## Project Overview

- **Architecture**: TypeScript Monorepo managed with Turborepo and NPM Workspaces.
- **Frontend**: Angular 21 SPA with Signal-based state management and PrimeNG components.
- **Backend**: Fastify (Node.js 20) REST API with modular plugin architecture and WebSocket support.
- **CLI**: Command-line tool for CI/CD integration using Commander.js.
- **Database**: YugabyteDB (PostgreSQL-compatible) with `pgvector` for RAG embeddings.
- **Infrastructure**: 10 language-specific Docker runners (Java, Python, Go, Rust, C#, JS, TS, Ruby, PHP, Kotlin) and Kubernetes orchestration.
- **AI Integration**: Supports OpenAI, Anthropic, LM Studio, and Ollama for code generation and auto-fill.

## Directory Structure

- `apps/api/`: Fastify backend service (Port 3000).
- `apps/web/`: Angular frontend application (Port 4200).
- `apps/cli/`: CLI tool (`testcraft` command).
- `packages/shared-types/`: Common TypeScript interfaces and node definitions.
- `docker/runners/`: Dockerfiles and runner scripts for 10 programming languages.
- `k8s/`: Kubernetes manifests for full-stack deployment and runner orchestration.
- `tests/framework/`: Integration test suite for validating 100+ node types.
- `scripts/`: Utility scripts for building runners and managing K8s deployments.

## Building and Running

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Kubernetes (optional, for K8s-specific nodes)

### Setup & Infrastructure
```bash
# Install all dependencies
npm install

# Start database (YugabyteDB)
make docker-up

# Build all language runner Docker images
make docker-build
```

### Development
```bash
# Start API + Frontend (Hot-reload)
npm run start:all

# Start individual components
npm run start:api  # Backend
npm run start:web  # Frontend
```

### Testing
```bash
# API Unit Tests (Vitest)
npm run test:api

# Full Integration Suite (185 tests against live API)
npm run test:full

# Quick Smoke Tests
npm run test:smoke

# Specific Node Category Tests
npm run test:samplers
npm run test:controllers
npm run test:assertions
```

### Database Migrations
```bash
cd apps/api
npm run migrate         # Apply pending migrations
npm run migrate:status  # Check migration status
```

## Development Conventions

### Naming & Style
- **Files**: `kebab-case.ts`
- **Classes/Interfaces**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Strict Mode**: TypeScript strict mode is enabled; avoid using `any`.
- **Imports**: Use `.js` extension for local imports in the API (ESM).

### Module Pattern (Backend)
Each module in `apps/api/src/modules/` typically follows this structure:
- `index.ts`: Public exports.
- `routes.ts`: Fastify route definitions.
- `service.ts`: Business logic and database interactions.
- `types.ts`: Module-specific type definitions.
- `*.test.ts`: Unit/integration tests.

### Adding New Node Types
1. Define the node type and config in `packages/shared-types/src/nodes.ts`.
2. Implement the executor in `apps/api/src/modules/execution/executors/`.
3. Register the executor in the execution engine.
4. Add integration tests in `tests/framework/test-cases/`.
5. Update documentation in `docs/HOCON-REFERENCE.md`.

### Documentation
When making changes, ensure relevant docs are updated:
- `SPEC.md`: Core system specification.
- `docs/ARCHITECTURE.md`: High-level system design.
- `docs/API-REFERENCE.md`: REST API documentation.
- `docs/DEVELOPMENT.md`: Onboarding and workflow guide.
- `docs/HOCON-REFERENCE.md`: Test plan configuration format.

## AI Configuration
Configure AI providers via environment variables in `apps/api/.env`:
- `AI_PROVIDER`: `openai`, `anthropic`, `lmstudio`, or `ollama`.
- `AI_API_KEY`: Your provider API key.
- `AI_MODEL`: Model ID (e.g., `claude-3-5-sonnet-20240620`).
- `LMSTUDIO_URL`: Local URL for LM Studio (default: `http://localhost:1234/v1`).
