# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TestForgeAI (TestCraft) is a performance/integration testing platform similar to JMeter, built as a TypeScript monorepo. It executes test plans defined in HOCON format across 10 language runners (Java, Python, Go, Rust, C#, JS, TS, Ruby, PHP, Kotlin) orchestrated via Kubernetes.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build all packages (respects dependency order via Turborepo)
npm run build

# Build individual packages
npm run build:api          # API only
npm run build:web          # Angular frontend only
npm run build:types        # shared-types only

# Development servers
npm run start:api          # API on port 3000 (tsx watch, auto-reload)
npm run start:web          # Angular on port 4200
npm run start:all          # Start everything via python3 start.py --no-docker

# Restart dev servers
npm run dev                # runs scripts/restart-dev.sh

# Type checking & linting
npm run typecheck
npm run lint
```

## Testing

Two separate test systems exist — do not confuse them:

**Vitest unit tests** (apps/api/) — test API services and modules in isolation:
```bash
npm run test:api                                    # all API tests
cd apps/api && npx vitest run src/__tests__/ai-service.test.ts  # single test file
cd apps/api && npx vitest --watch                   # watch mode
```

Vitest config: globals enabled (describe/it/expect available without import, though some tests import them explicitly), 30s timeout, tests live in `apps/api/src/__tests__/*.test.ts`. Mocking uses `vi.mock()` for module-level mocks and `vi.fn()` for individual functions. Global fetch is mocked via `global.fetch = vi.fn()`.

**Integration test framework** (tests/framework/) — custom runner that hits the live API at `POST /api/v1/test/node`:
```bash
npm run test:nodes         # all node type tests
npm run test:smoke         # quick smoke subset
npm run test:full          # full 185-test suite
npm run test:samplers      # sampler nodes only
npm run test:controllers   # controller nodes only
npm run test:http          # HTTP tests only
npm run test:assertions    # assertion nodes only

# Debug mode — prints actual output for failed tests
DEBUG_TESTS=1 npm run test:nodes

# Run against K8s or remote API
API_URL=http://testcraft.local/api/v1 npm run test:full
```

## Infrastructure

```bash
# Local infrastructure (YugabyteDB on port 5433)
docker compose up -d yugabyte     # or: make docker-up (with healthcheck wait)

# Database migrations
cd apps/api && npm run migrate
cd apps/api && npm run migrate:rollback
cd apps/api && npm run migrate:status

# Build language runner Docker images
make docker-build

# Kubernetes
make k8s-up              # deploy full stack
make k8s-rebuild         # redeploy after code changes
make k8s-down            # delete testcraft namespace
make k8s-logs-api        # tail API logs
```

## Monorepo Structure

```
apps/api/         → Fastify REST API (port 3000), @testcraft/api
apps/web/         → Angular 21 frontend (port 4200), @testcraft/web
apps/cli/         → Commander.js CLI ("testcraft" command), @testcraft/cli
packages/shared-types/ → Canonical TypeScript types, @testcraft/shared-types
docker/runners/   → 10 language-specific Docker containers
k8s/              → Kubernetes manifests (Kustomize)
tests/            → Integration test framework + HOCON samples
```

Workspaces use npm with Turborepo orchestration. Cross-package imports use `@testcraft/shared-types`.

## Architecture

### API (apps/api/)

Fastify with plugin architecture. Server bootstrap in `src/main.ts` follows four phases: `createServer()` → `registerPlugins()` → `registerRoutes()` → `initializeDatabase()`.

**Route module pattern:** Each module exports an async function registered with a prefix in `main.ts`:
```typescript
// In src/modules/foo/routes.ts
export async function fooRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: z.infer<typeof MySchema> }>('/', async (request, reply) => {
    const data = MySchema.parse(request.body);
    // ...
  });
}

// In main.ts
await app.register(fooRoutes, { prefix: '/api/v1/foo' });
```

All routes are under `/api/v1/` prefix. Request validation uses Zod schemas (parse in handler, catch ZodError → 400). Auth-protected routes check `request.user` (set by auth plugin). Admin routes use `{ preHandler: [requireRole('admin')] }`.

**AI routes** get special treatment — registered inside a scoped plugin with a stricter rate limit middleware applied via `aiApp.addHook('onRequest', createRateLimitMiddleware(...))`.

**Auth in development:** Set `AUTH_SKIP_IN_DEV=true` to bypass all auth checks — the plugin injects a hardcoded admin user. This is the standard local dev workflow.

**Database:** `db` singleton from `src/modules/database/yugabyte-client.ts` wraps `pg.Pool`. 14 migrations in `migrations.ts` (001–014). In non-production, the API continues with a warning if DB is unavailable.

**Config:** All environment variables are loaded in `src/config/index.ts` via `requireEnv()` / `optionalEnv()` helpers. Never read `process.env` directly elsewhere — add new env vars to the config object.

### Shared Types (packages/shared-types/)

**`src/nodes.ts`** is the canonical source for all type definitions: `NodeType` (100+ string literal union), `NodeConfig` (discriminated union on `type` field), `BaseNodeConfig`, `SupportedLanguage`, `ExecutionRequest`, `ExecutionResult`, `TreeNode`, `TestPlan`, etc.

**`src/index.ts`** re-exports everything from `nodes.ts` via `export *`. Never define types in `index.ts` directly — always add them to `nodes.ts`.

### Web (apps/web/)

Angular 21 with PrimeNG component library. All routes use `loadComponent` (lazy-loaded standalone components, no NgModules).

**State management:** Signal-based stores as `@Injectable({ providedIn: 'root' })` classes. Private state in `signal<T>()`, public via `.asReadonly()` or `computed()`. Mutations use `signal.set()` / `signal.update()`.

**Real-time updates:** `ExecutionStore` subscribes to `WebSocketService` observables (onExecutionStarted, onNodeStarted, onNodeCompleted, etc.) using `takeUntil(destroy$)`.

**API layer:** `BaseApiService` wraps `HttpClient` with timeout and error handling. Feature services extend it and call `this.get<T>()` etc. Default base URL: `/api/v1`.

**Local persistence:** `TestPlanStore` saves plans to `localStorage` under `testcraft-plans` and `testcraft-current-plan`.

### Runner Containers (docker/runners/)

Each language has a `Dockerfile` + `runner.sh`. Runners are Alpine Linux-based, run as non-root, accept code via files, execute with configurable timeout, and output structured JSON results. Important: Alpine uses BusyBox — no GNU date extensions (`%N` for nanoseconds).

### CLI (apps/cli/)

Commander.js CLI with commands: `run`, `validate`, `export`, `import`, `list`, `init`. Default API URL from `TESTCRAFT_API_URL` env var (default `http://localhost:3000`).

## Key Conventions

- **ESM everywhere**: Use `.js` extensions in imports even for TypeScript files (`import { x } from './module.js'`). This is required by `NodeNext` module resolution in the API.
- **Logger**: `import { logger } from '../../common/logger.js'` (not `../logging/logger`)
- **Route modules**: Export `async function fooRoutes(app: FastifyInstance): Promise<void>` and register in `main.ts`
- **Type imports**: Use `import type { ... }` for type-only imports
- **Prettier**: 100 char width, single quotes, angular HTML parser
- **API config**: All environment variables loaded in `apps/api/src/config/index.ts` — add new env vars there
- **Strict TypeScript**: `strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch` in root tsconfig
- **Path aliases**: `@testcraft/shared-types` maps to `packages/shared-types/src/index.ts`
- **API tsconfig**: `module: "NodeNext"` / `moduleResolution: "NodeNext"` — enforces `.js` extensions
- **Web tsconfig**: `moduleResolution: "bundler"` — no `.js` extensions needed in Angular code
