# Architecture

DriftGuard separates responsibilities across three layers.

## Infrastructure

Terraform owns AWS resources: VPC, subnets, one NAT gateway, EKS, a small managed node group, ECR repositories, and IAM/OIDC integration. The node group defaults to two `t3.medium` spot instances for dev because the target usage is a daily-created demo cluster. Prod keeps the same low baseline but disables spot by default to demonstrate the operational tradeoff.

Remote state is declared through S3 with DynamoDB locking. The backend file intentionally uses placeholders because bucket names, lock table names, and account details are account-specific.

## Delivery

ArgoCD uses the app-of-apps pattern. One root app reads the `argocd/` directory and creates a project plus one Application per service and environment. Each service has a Helm chart and per-environment values.

`checkout-svc` uses canary delivery with 20, 40, 60, and 100 percent rollout steps. This is a low-cost replica-weighted canary, which avoids introducing an ingress controller or service mesh solely for a portfolio demo. The tradeoff is that traffic weighting is approximate; for production edge traffic, pair Argo Rollouts with ALB, NGINX, Istio, or another traffic router.

`payments-svc` uses blue-green delivery with active and preview Services. Auto-promotion is disabled because payments-like workloads often require a deliberate preview validation before traffic is switched.

## Observability And Rollback

Both services expose the same Prometheus metric names:

- `driftguard_http_requests_total`
- `driftguard_http_request_duration_seconds`

ServiceMonitors scrape the active Services. AnalysisTemplates query Prometheus for 5xx rate and p95 latency. If either metric breaches its threshold, Argo Rollouts marks the analysis failed and aborts the rollout.

The `FAIL_RATE` environment variable exists only to make failure demonstrations repeatable.

