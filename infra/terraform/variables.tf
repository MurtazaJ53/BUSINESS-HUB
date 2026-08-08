variable "project_name" {
  description = "Canonical project name used across Tier A resources."
  type        = string
  default     = "business-hub"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "Primary AWS region for the environment."
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "Tier A VPC range."
  type        = string
  default     = "10.40.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "Private subnet ranges for app and data services."
  type        = list(string)
  default = [
    "10.40.1.0/24",
    "10.40.2.0/24",
  ]
}

variable "public_subnet_cidrs" {
  description = "Public subnet ranges for ingress and edge-facing services."
  type        = list(string)
  default = [
    "10.40.101.0/24",
    "10.40.102.0/24",
  ]
}
