#!/usr/bin/env bash
set -euo pipefail

ARGOCD_VERSION="${ARGOCD_VERSION:-v3.5.0}"
ARGO_ROLLOUTS_VERSION="${ARGO_ROLLOUTS_VERSION:-v1.9.1}"
KUBE_PROM_STACK_VERSION="${KUBE_PROM_STACK_VERSION:-87.18.1}"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    echo "Install it, confirm '$1 version' works, then rerun this script." >&2
    exit 1
  fi
}

require_tool kubectl
require_tool helm

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
# ArgoCD CRDs are large enough that client-side apply can exceed the
# kubectl.kubernetes.io/last-applied-configuration annotation limit.
kubectl apply --server-side --force-conflicts -n argocd \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

kubectl create namespace argo-rollouts --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side --force-conflicts -n argo-rollouts \
  -f "https://github.com/argoproj/argo-rollouts/releases/download/${ARGO_ROLLOUTS_VERSION}/install.yaml"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --version "${KUBE_PROM_STACK_VERSION}" \
  --values observability/kube-prometheus-values.yaml

kubectl -n monitoring create configmap driftguard-grafana-dashboard \
  --from-file=driftguard.json=observability/grafana-dashboards/driftguard.json \
  --dry-run=client -o yaml \
  | kubectl label --local -f - grafana_dashboard=1 -o yaml \
  | kubectl apply -f -

echo "Bootstrap complete. Apply argocd/bootstrap/root-app.yaml after replacing Git repo placeholders."
