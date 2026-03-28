# TestForgeAI — Gemini CLI Context

TestForgeAI (TestCraft) is a performance/integration testing platform — a modern TypeScript-based alternative to Apache JMeter. Test plans are defined in HOCON format and executed across 10 language runners (Java, Python, Go, Rust, C#, JS, TS, Ruby, PHP, Kotlin) orchestrated on Kubernetes.

---

## Running Privileged Commands

When you need Docker or other commands that require group membership:
```bash
# Activate docker group in current session before any docker commands
sg docker -c "docker ps"
sg docker -c "docker build -t testcraft/runner-java:latest docker/runners/java/"

# For minikube
sg docker -c "minikube status"
```

Minikube cluster: `192.168.49.2:8443` (add to `no_proxy` if using a proxy to avoid ERR_INVALID_ARG_VALUE).

---

## Monorepo Layout

```
apps/api/              → Fastify REST API, port 3000  (@testcraft/api)
apps/web/              → Angular 21 frontend, port 4200  (@testcraft/web)
apps/cli/              → Commander.js CLI  (@testcraft/cli)
packages/shared-types/ → Canonical TypeScript types  (@testcraft/shared-types)
docker/runners/        → 10 language Docker containers + runner.sh scripts
k8s/                   → Kubernetes manifests (Kustomize)
tests/                 → Integration tests + 8 HOCON scenario samples
```

All shared types live in `packages/shared-types/src/nodes.ts`. Never define types elsewhere.

---

## Build & Run Commands

```bash
# Install dependencies
npm install

# Build everything (Turborepo, respects dependency order)
npm run build

# Start API only (tsx watch, port 3000)
npm run start:api

# Start Angular frontend (port 4200)
npm run start:web

# Start both
npm run start:all   # runs python3 start.py --no-docker

# Type-check
npm run typecheck
```

---

## Infrastructure

```bash
# YugabyteDB on port 5433 (PostgreSQL-compatible)
make docker-up            # starts with healthcheck wait
# or
sg docker -c "docker compose up -d yugabyte"

# Database migrations (must run after docker-up)
cd apps/api && npm run migrate
cd apps/api && npm run migrate:status
cd apps/api && npm run migrate:rollback

# Build all language runner Docker images
make docker-build
# or
sg docker -c "bash scripts/build-runners.sh"

# Kubernetes
make k8s-up              # deploy full stack to minikube
make k8s-rebuild         # redeploy after code changes
make k8s-down            # delete testcraft namespace
make k8s-logs-api        # tail API logs
```

---

## Testing

### Vitest Unit Tests (apps/api/)
```bash
npm run test:api                                          # all unit tests
cd apps/api && npx vitest run src/__tests__/ai-service.test.ts  # single file
cd apps/api && npx vitest --watch                         # watch mode
```

Tests use `vi.mock()` / `vi.fn()`. Global fetch mocked via `global.fetch = vi.fn()`. 30s timeout.

### Integration Tests (live API required)
```bash
npm run test:nodes          # all node types
npm run test:smoke          # quick subset
npm run test:full           # 185-test suite
npm run test:samplers
npm run test:controllers
npm run test:http
npm run test:assertions

DEBUG_TESTS=1 npm run test:nodes                        # print failed output
API_URL=http://testcraft.local/api/v1 npm run test:full # against K8s
```

### Scenario Validator (imports all 8 HOCON files, runs every node)
```bash
npx tsx tests/validate-scenarios.ts
# Output: N passed / N failed / N skipped (requires infra)
# Nodes requiring K8s, YugabyteDB, Kafka, AI key, Redis are auto-skipped
```

---

## API Architecture

**Server bootstrap** (`src/main.ts`): `createServer()` → `registerPlugins()` → `registerRoutes()` → `initializeDatabase()`

**Route pattern**: Each module exports `async function fooRoutes(app: FastifyInstance)` and is registered in `main.ts`:
```typescript
await app.register(fooRoutes, { prefix: '/api/v1/foo' });
```

**Auth**: In development, set `AUTH_SKIP_IN_DEV=true` — injects hardcoded admin user, bypasses all auth checks.

**Config**: All env vars loaded from `src/config/index.ts` via `requireEnv()` / `optionalEnv()`. Never read `process.env` directly elsewhere.

**Database**: `db` singleton from `src/modules/database/yugabyte-client.ts` wraps `pg.Pool`. 16 migrations in `migrations.ts`.

**Logging**: `import { logger } from '../../common/logger.js'` (not `../logging/logger`).

---

## GlobalVarsService — Variable State for Runners

Docker/K8s runner containers access live execution variables via REST instead of passing them at startup (which would miss updates). Architecture:

**Service**: `apps/api/src/modules/vars/vars-service.ts`
- In-memory L1 cache (Map) + YugabyteDB L2 (`execution_vars` table, migration 016)
- `getAll(executionId)` — L1 hit or DB fallback
- `setMany(executionId, vars)` — upsert both layers
- `seed(executionId, planVars)` — called at execution start from `inputs`
- `clear(executionId)` — cleanup after execution

**REST endpoints** (`/api/v1/vars/:executionId`):
- `GET` — returns flat JSON map `{ "varName": value, ... }` — runners call this at startup
- `POST { vars: {...} }` — merge/upsert variables — runners call this after execution
- `DELETE` — cleanup

**DB table** (migration 016):
```sql
CREATE TABLE IF NOT EXISTS execution_vars (
  execution_id TEXT NOT NULL,
  var_name     TEXT NOT NULL,
  var_value    JSONB,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (execution_id, var_name)
);
```

**Orchestrator** injects into every K8s pod:
```
TESTCRAFT_API_URL=http://testcraft-api:3000/api/v1
TESTCRAFT_EXECUTION_ID=<uuid>
```

**Runner scripts** (all 10 languages) follow this pattern:
1. `curl GET /api/v1/vars/$TESTCRAFT_EXECUTION_ID` → write `_tc_vars.json`
2. Expose as `tc_vars` (Python dict / JS object / etc.) to user code
3. After execution: read `_tc_extracted.json`, `curl POST /api/v1/vars/$TESTCRAFT_EXECUTION_ID`

User code in Python: `tc_vars["my_key"]`
User code in JavaScript: `tc.vars["my_key"]` or `tc_vars["my_key"]`

---

## HOCON Test Plan Format

### Variable Syntax
```hocon
variables {
  db_host = ${?DB_HOST} "localhost"   # checks process.env.DB_HOST first, else "localhost"
  db_port = ${?DB_PORT} 5433          # numeric fallback
  flag    = ${?ENABLE_X} true         # boolean fallback
  bare    = ${?MAYBE_UNSET}           # resolves to "" if not set
}
```

The HOCON parser (`src/modules/hocon/parser.ts`) resolves `${?VAR} default` by checking `process.env[VAR]` first — environment variable wins over the literal default.

### Node Types (lowercase only — validated by API)
Common types: `shell-command`, `http-request`, `code-execution`, `jdbc-request`, `redis-request`, `kafka-producer`, `kafka-consumer`, `websocket-request`, `grpc-request`, `graphql-request`, `loop-controller`, `parallel-controller`, `if-controller`, `constant-timer`, `context-setup`, `ai-data-generator`, `ai-response-validator`, `k8s-pod`, `script-sampler`

### Import a HOCON plan
```bash
curl -X POST http://localhost:3000/api/v1/plans/import \
  -H "Content-Type: application/json" \
  -d '{"content": "<hocon text>", "format": "hocon"}'
```

---

## Key Conventions

- **ESM imports**: Use `.js` extension in API (`import { x } from './module.js'`). Required by `NodeNext` module resolution.
- **No `.js` in Angular**: Web uses `moduleResolution: "bundler"`.
- **Zod validation**: Parse in handler with `MySchema.parse(request.body)`, catch `ZodError` → 400.
- **Rate limiting**: AI routes use a scoped plugin with stricter rate limit middleware.
- **Warm pool state**: Orchestrator cleans `CODE_DIR`/`OUTPUT_DIR` before each pod reuse to prevent file leakage between executions.
- **Pod deadline**: `activeDeadlineSeconds = timeout + 60` — extra 60s accounts for K8s scheduler overhead.
- **Encryption key**: `CONTEXT_ENCRYPTION_KEY` must be stable across restarts — if absent in production, encrypted context vars become unreadable after restart.
- **Prettier**: 100 char width, single quotes, angular HTML parser.

---

## Environment Variables (apps/api/.env)

```
# Database
DATABASE_URL=postgresql://yugabyte:yugabyte@localhost:5433/testcraft
YUGABYTE_HOST=localhost
YUGABYTE_PORT=5433

# Auth
JWT_SECRET=<secret>
AUTH_SKIP_IN_DEV=true

# AI
AI_PROVIDER=anthropic        # openai | anthropic | lmstudio | ollama
AI_API_KEY=<key>
AI_MODEL=claude-sonnet-4-6

# Runners
TESTCRAFT_API_URL=http://testcraft-api:3000/api/v1   # URL runners use to fetch vars

# Context
CONTEXT_ENCRYPTION_KEY=<stable-32-byte-key>          # required for encrypted context vars
```

---

## Adding a New Feature

### New route module
1. Create `apps/api/src/modules/foo/routes.ts` exporting `async function fooRoutes(app: FastifyInstance)`
2. Register in `apps/api/src/main.ts`: `await app.register(fooRoutes, { prefix: '/api/v1/foo' });`

### New node type
1. Add to `NodeType` union and `NodeConfig` discriminated union in `packages/shared-types/src/nodes.ts`
2. Implement handler in `apps/api/src/modules/testing/routes.ts` (switch statement in `POST /test/node`)
3. Add test cases in `tests/framework/test-cases/`
4. Document in `docs/HOCON-REFERENCE.md`

### New migration
Add numbered entry to the `migrations` array in `apps/api/src/modules/database/migrations.ts`, then run `cd apps/api && npm run migrate`.

---

## Process Management

- Always use `is_background: true` for long-running services (API, databases, mock servers) and ensure they are properly detached to persist across turns.
- Never kill or restart background processes unless explicitly requested or required for a code change.
- Always verify the state of detached processes at the start of a turn if they are required for the task.
- When control returns to me after a command, I must immediately verify the output and system state.

---

## Recent Changes (session 2026-03-25)

- **GlobalVarsService**: Added `apps/api/src/modules/vars/` — full dual-layer variable store with REST API for runner containers
- **Migration 016**: `execution_vars` table for persistent variable state across runner restarts
- **All 10 runner scripts**: Now fetch vars from API at startup, expose as `tc_vars`, push `extracted_values` back after execution
- **HOCON `${?VAR} default`**: Parser now checks `process.env` first before using literal fallback
- **http-request node**: Now accepts full `url` field (previously only JMeter-style split fields worked)
- **HOCON sample files**: Fixed node type casing (`Shell-Command` → `shell-command`, etc.) across all 8 scenario files
- **Java runner**: Added `jq` to Dockerfile (was the only runner missing it)
- **Warm pool**: Orchestrator now cleans code/output dirs before pod reuse
- **Pod deadline**: Changed `activeDeadlineSeconds` from `timeout` to `timeout + 60`
- **Context encryption warning**: Added production warning when `CONTEXT_ENCRYPTION_KEY` is absent
