terraform {
  backend "s3" {
    # Replace these placeholders during `terraform init -backend-config=...`.
    # They are intentionally not account-specific so no AWS IDs or secrets live in Git.
    bucket         = "REPLACE_WITH_TERRAFORM_STATE_BUCKET"
    key            = "driftguard/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "REPLACE_WITH_TERRAFORM_LOCK_TABLE"
    encrypt        = true
  }
}

