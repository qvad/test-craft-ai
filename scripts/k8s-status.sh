#!/bin/bash

echo "=== TestCraft K8s Status ==="
echo ""
echo "Pods:"
kubectl -n testcraft get pods -o wide 2>/dev/null || echo "Namespace not found"
echo ""
echo "Services:"
kubectl -n testcraft get svc 2>/dev/null || true
echo ""
echo "Ingress:"
kubectl -n testcraft get ingress 2>/dev/null || true
