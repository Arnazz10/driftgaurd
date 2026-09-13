#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-dev}"

echo "Deleting a Service to demonstrate ArgoCD self-heal."
kubectl delete service checkout-svc -n "${NAMESPACE}" --ignore-not-found
echo "Watch ArgoCD recreate it:"
echo "kubectl get service checkout-svc -n ${NAMESPACE} --watch"

