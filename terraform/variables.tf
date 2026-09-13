variable "aws_region" {
  description = "AWS region for all DriftGuard resources."
  type        = string
}

variable "environment" {
  description = "Deployment environment name."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
}

variable "kubernetes_version" {
  description = "EKS Kubernetes minor version."
  type        = string
  default     = "1.36"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "Availability zones used for public/private subnets."
  type        = list(string)
}

variable "node_instance_types" {
  description = "Small, cheap node type list for the managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  description = "Desired node count."
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum node count."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum node count."
  type        = number
  default     = 3
}

variable "use_spot" {
  description = "Use spot capacity for the managed node group."
  type        = bool
  default     = true
}

variable "github_org" {
  description = "GitHub organization or username used for OIDC trust. Placeholder value is safe."
  type        = string
  default     = "Arnazz10"
}

variable "github_repo" {
  description = "GitHub repository name used for OIDC trust."
  type        = string
  default     = "driftguard"
}

