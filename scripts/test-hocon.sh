#!/usr/bin/env bash
# Run all HOCON scenario files: start DB → migrate → start API → validate → teardown
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
API_URL="${API_URL:-http://localhost:3000/api/v1}"
API_PID=""

log() { echo "[test-hocon] $*"; }

cleanup() {
  log "Tearing down..."
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" && wait "$API_PID" 2>/dev/null || true
    log "API stopped"
  fi
  sg docker -c "docker compose -f '$ROOT/docker-compose.yaml' stop yugabyte" 2>/dev/null || true
  log "YugabyteDB stopped"
}
trap cleanup EXIT

# ── 1. Start YugabyteDB ─────────────────────────────────────────────────────
log "Starting YugabyteDB..."
sg docker -c "docker compose -f '$ROOT/docker-compose.yaml' up -d yugabyte"

log "Waiting for YugabyteDB to be healthy..."
for i in $(seq 1 30); do
  if sg docker -c "docker compose -f '$ROOT/docker-compose.yaml' ps yugabyte" 2>/dev/null | grep -q "healthy"; then
    log "YugabyteDB is healthy"
    break
  fi
  if [[ $i -eq 30 ]]; then
    log "ERROR: YugabyteDB did not become healthy in 300s"
    exit 1
  fi
  sleep 10
done

# ── 2. Run migrations ────────────────────────────────────────────────────────
log "Running migrations..."
cd "$ROOT/apps/api"
DB_HOST=localhost DB_PORT=5433 DB_NAME=testcraft DB_USER=yugabyte DB_PASSWORD=yugabyte \
  npx tsx src/scripts/migrate.ts
cd "$ROOT"

# ── 3. Start API ─────────────────────────────────────────────────────────────
log "Starting API..."
cd "$ROOT/apps/api"
AUTH_SKIP_IN_DEV=true \
DB_HOST=localhost DB_PORT=5433 DB_NAME=testcraft DB_USER=yugabyte DB_PASSWORD=yugabyte \
NODE_ENV=development PORT=3000 LOG_LEVEL=warn LOG_FORMAT=json \
  npx tsx src/main.ts &
API_PID=$!
cd "$ROOT"

log "Waiting for API health at $API_URL/health..."
for i in $(seq 1 30); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    log "API is up"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    log "ERROR: API process died"
    exit 1
  fi
  if [[ $i -eq 30 ]]; then
    log "ERROR: API did not respond in 60s"
    exit 1
  fi
  sleep 2
done

# ── 4. Run HOCON scenario validator ──────────────────────────────────────────
log "Running HOCON scenario validator..."
cd "$ROOT"
API_URL="$API_URL" npx tsx tests/validate-scenarios.ts
RESULT=$?

log "Validator exited with code $RESULT"
exit $RESULT
