#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-dev}"
ROLLOUT="checkout-svc"

echo "Bump charts/checkout-svc/values-${NAMESPACE}.yaml image.tag and env.version, commit, then watch:"
echo "kubectl argo rollouts get rollout ${ROLLOUT} -n ${NAMESPACE} --watch"
kubectl argo rollouts get rollout "${ROLLOUT}" -n "${NAMESPACE}" --watch

