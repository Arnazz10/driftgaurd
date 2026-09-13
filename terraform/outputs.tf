output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "ecr_repositories" {
  value = { for name, repo in aws_ecr_repository.services : name => repo.repository_url }
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.eks.arn
}

