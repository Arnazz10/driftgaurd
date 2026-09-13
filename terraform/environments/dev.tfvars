aws_region         = "us-east-1"
environment        = "dev"
cluster_name       = "driftguard-dev"
vpc_cidr           = "10.40.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]
node_desired_size  = 2
node_min_size      = 2
node_max_size      = 3
use_spot           = true

