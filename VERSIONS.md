# Versions

Pinned versions are intentionally explicit so upgrades are reviewable.

| Component | Version | Why |
| --- | --- | --- |
| Terraform CLI | 1.15.4 | Latest stable release found in HashiCorp release listings. |
| Terraform AWS provider | 6.57.1 | Latest AWS provider patch in the 6.x line, chosen over 6.57.0 because the upstream changelog flags 6.57.0 as problematic. |
| Terraform TLS provider | 4.1.0 | Current stable TLS provider line used for OIDC certificate data. |
| EKS Kubernetes | 1.36 | Latest EKS standard-support minor version listed by AWS. |
| Go | 1.26.1 | Latest Go 1.26 security/bugfix release found in official Go release history. |
| Distroless runtime | `gcr.io/distroless/static-debian13:nonroot` | Current distroless static Debian family with non-root runtime. |
| ArgoCD | 3.5.0 | Latest stable ArgoCD minor release schedule at generation time. |
| Argo Rollouts | 1.9.1 | Latest stable Argo Rollouts release, including security fixes. |
| kube-prometheus-stack | 87.18.1 | Latest Artifact Hub chart version found for Prometheus/Grafana/operator stack. |
| Helm CLI | 4.2.0 | Latest stable Helm release found; scripts work with Helm 3 style commands as well. |
| Trivy action | 0.32.0 | Pinned GitHub Action wrapper for image scans. |
| Trivy engine | 0.72.0 | Latest Trivy release noted in upstream changelog at generation time. |
| actions/checkout | 6.0.2 | Latest stable checkout action release found. |
| aws-actions/configure-aws-credentials | 6.1.2 | Latest stable AWS OIDC credentials action release found. |

Sources checked:

- AWS EKS Kubernetes versions: https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html
- Terraform AWS provider changelog: https://github.com/hashicorp/terraform-provider-aws/blob/main/CHANGELOG.md
- Terraform releases: https://github.com/hashicorp/terraform/releases
- Go release history: https://go.dev/doc/devel/release
- Distroless image list: https://github.com/GoogleContainerTools/distroless
- Argo Rollouts releases: https://github.com/argoproj/argo-rollouts/releases
- kube-prometheus-stack chart: https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack
- GitHub checkout action: https://github.com/actions/checkout
- AWS credentials action: https://github.com/aws-actions/configure-aws-credentials
- Trivy changelog: https://github.com/aquasecurity/trivy/blob/main/CHANGELOG.md

