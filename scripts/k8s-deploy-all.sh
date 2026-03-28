#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== TestCraft Full K8s Deployment ==="
echo ""

# Check if minikube cluster exists
if ! minikube status 2>/dev/null | grep -q "Running"; then
    echo "Starting minikube cluster..."
    minikube start --driver=docker --cpus=4 --memory=8192
fi

# Build Docker images
echo ""
echo "Building API image..."
sg docker -c "docker build -t testcraft-api:v2 -f \"$PROJECT_DIR/docker/Dockerfile.api\" \"$PROJECT_DIR\""

echo ""
echo "Building UI image..."
sg docker -c "docker build -t testcraft-ui:latest -f \"$PROJECT_DIR/docker/Dockerfile.ui\" \"$PROJECT_DIR\""

# Load images into minikube
echo ""
echo "Loading images into minikube..."
minikube image load testcraft-api:v2
minikube image load testcraft-ui:latest

# Apply K8s manifests
echo ""
echo "Applying K8s manifests..."
kubectl apply -f "$PROJECT_DIR/k8s/namespace.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/yugabyte.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/redis.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/api.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/ui.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/ingress.yaml"

# Wait for deployments
echo ""
echo "Waiting for YugabyteDB to be ready (this takes ~2 minutes)..."
kubectl -n testcraft wait --for=condition=ready pod -l app=yugabyte --timeout=300s 2>/dev/null || echo "YugabyteDB still starting..."

echo "Waiting for Redis..."
kubectl -n testcraft wait --for=condition=ready pod -l app=redis --timeout=60s

echo "Waiting for API..."
kubectl -n testcraft wait --for=condition=ready pod -l app=api --timeout=120s

echo "Waiting for UI..."
kubectl -n testcraft wait --for=condition=ready pod -l app=ui --timeout=60s

# Initialize pgvector extension
echo ""
echo "Initializing database..."
kubectl -n testcraft exec -it statefulset/yugabyte -- bash -c "PGPASSWORD=yugabyte ysqlsh -h \$(hostname -i) -p 5433 -U yugabyte -c 'CREATE EXTENSION IF NOT EXISTS vector;'" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "Add to /etc/hosts:"
echo "  127.0.0.1 testcraft.local"
echo ""
echo "Access:"
echo "  UI:  http://testcraft.local"
echo "  API: http://testcraft.local/api/v1/health"
echo ""
echo "Commands:"
echo "  kubectl -n testcraft get pods"
echo "  kubectl -n testcraft logs -f deployment/api"
echo "  ./scripts/k8s-rebuild.sh        # Rebuild after code changes"
echo ""
