#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-dev}"
ROLLOUT="payments-svc"

echo "Watch the preview ReplicaSet become healthy, then promote when ready."
kubectl argo rollouts get rollout "${ROLLOUT}" -n "${NAMESPACE}" --watch
echo "Promotion command:"
echo "kubectl argo rollouts promote ${ROLLOUT} -n ${NAMESPACE}"

