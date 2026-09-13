terraform {
  required_version = ">= 1.15.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.57.1"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "= 4.1.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "driftguard"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

