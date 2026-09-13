#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-dev}"

echo "Destroying DriftGuard ${ENVIRONMENT}. This removes billable AWS resources."
terraform -chdir=terraform destroy -var-file="environments/${ENVIRONMENT}.tfvars"

