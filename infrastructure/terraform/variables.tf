# ==============================================================================
# Terraform Variables — Supply Chain Risk Intelligence System
# ==============================================================================

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "dev"
}

# --- VPC & Networking --------------------------------------------------------

variable "vpc_id" {
  description = "VPC ID for security group placement"
  type        = string
}

variable "rds_subnet_ids" {
  description = "List of subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "rds_allowed_cidrs" {
  description = "CIDR blocks allowed to connect to the RDS instance"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

# --- RDS Configuration -------------------------------------------------------

variable "rds_db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "risk_intelligence"
}

variable "rds_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "db_orchestrator"
}

variable "rds_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "rds_publicly_accessible" {
  description = "Whether the RDS instance is publicly accessible"
  type        = bool
  default     = false
}

# --- Agent Configuration -----------------------------------------------------

variable "zscore_anomaly_threshold" {
  description = "Z-score threshold for commodity price anomaly triggers"
  type        = string
  default     = "2.5"
}
