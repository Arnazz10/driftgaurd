#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-dev}"

cat <<MSG
Set env.failRate to "0.5" and bump image.tag/env.version for checkout-svc or payments-svc,
then commit the Helm values change. The AnalysisTemplate should fail the error-rate gate.

Watch checkout:
  kubectl argo rollouts get rollout checkout-svc -n ${NAMESPACE} --watch

Watch payments:
  kubectl argo rollouts get rollout payments-svc -n ${NAMESPACE} --watch
MSG

