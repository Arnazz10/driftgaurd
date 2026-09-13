aws_region         = "us-east-1"
environment        = "prod"
cluster_name       = "driftguard-prod"
vpc_cidr           = "10.50.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]
node_desired_size  = 2
node_min_size      = 2
node_max_size      = 4
use_spot           = false

