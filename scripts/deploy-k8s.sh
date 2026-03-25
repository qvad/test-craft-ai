#!/bin/bash
set -e

# Deploy TestCraft runners to Kubernetes
# Usage: ./scripts/deploy-k8s.sh [apply|delete]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="${PROJECT_ROOT}/k8s"

ACTION="${1:-apply}"

echo "=========================================="
echo "TestCraft Kubernetes Deployment"
echo "=========================================="
echo "Action: ${ACTION}"
echo ""

case "$ACTION" in
    apply)
        echo "Creating namespace and base resources..."
        kubectl apply -f "${K8S_DIR}/base/namespace.yaml"

        echo "Creating RBAC resources..."
        kubectl apply -f "${K8S_DIR}/base/rbac.yaml"

        echo "Creating ConfigMaps..."
        kubectl apply -f "${K8S_DIR}/base/configmap.yaml"

        echo "Deploying runner pools..."
        kubectl apply -f "${K8S_DIR}/runners/"

        echo ""
        echo "Waiting for deployments to be ready..."
        kubectl -n testcraft-runners wait --for=condition=available --timeout=120s deployment --all || true

        echo ""
        echo "Deployment complete! Current status:"
        kubectl -n testcraft-runners get pods
        ;;

    delete)
        echo "Deleting runner deployments..."
        kubectl delete -f "${K8S_DIR}/runners/" --ignore-not-found

        echo "Deleting ConfigMaps..."
        kubectl delete -f "${K8S_DIR}/base/configmap.yaml" --ignore-not-found

        echo "Deleting RBAC resources..."
        kubectl delete -f "${K8S_DIR}/base/rbac.yaml" --ignore-not-found

        echo "Deleting namespace..."
        kubectl delete -f "${K8S_DIR}/base/namespace.yaml" --ignore-not-found

        echo ""
        echo "Cleanup complete!"
        ;;

    status)
        echo "Runner pool status:"
        kubectl -n testcraft-runners get pods -o wide

        echo ""
        echo "Deployments:"
        kubectl -n testcraft-runners get deployments

        echo ""
        echo "Resource usage:"
        kubectl -n testcraft-runners top pods 2>/dev/null || echo "Metrics not available"
        ;;

    logs)
        LANGUAGE="${2:-java}"
        echo "Getting logs for ${LANGUAGE} runner..."
        kubectl -n testcraft-runners logs -l "testcraft.io/language=${LANGUAGE}" --tail=100
        ;;

    *)
        echo "Usage: $0 {apply|delete|status|logs [language]}"
        exit 1
        ;;
esac
