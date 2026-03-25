#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

COMPONENT="${1:-all}"

echo "=== Quick K8s Rebuild: $COMPONENT ==="

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
if [ "$COMPONENT" = "api" ] || [ "$COMPONENT" = "all" ]; then
    kubectl -n testcraft rollout status deployment/api --timeout=60s
fi
if [ "$COMPONENT" = "ui" ] || [ "$COMPONENT" = "all" ]; then
    kubectl -n testcraft rollout status deployment/ui --timeout=60s
fi

echo ""
echo "Done! Access at http://testcraft.local"
