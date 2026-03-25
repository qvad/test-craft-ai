#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Quick rebuild and redeploy for development
echo "=== Quick Dev Rebuild ==="

COMPONENT="${1:-all}"

if [ "$COMPONENT" = "api" ] || [ "$COMPONENT" = "all" ]; then
    echo "Rebuilding API..."
    docker build -t testcraft-api:latest -f "$PROJECT_DIR/docker/Dockerfile.api" "$PROJECT_DIR"
    kind load docker-image testcraft-api:latest
    kubectl -n testcraft rollout restart deployment/api
fi

if [ "$COMPONENT" = "ui" ] || [ "$COMPONENT" = "all" ]; then
    echo "Rebuilding UI..."
    docker build -t testcraft-ui:latest -f "$PROJECT_DIR/docker/Dockerfile.ui" "$PROJECT_DIR"
    kind load docker-image testcraft-ui:latest
    kubectl -n testcraft rollout restart deployment/ui
fi

echo "Waiting for rollout..."
kubectl -n testcraft rollout status deployment/api --timeout=60s
kubectl -n testcraft rollout status deployment/ui --timeout=60s

echo "Done!"
