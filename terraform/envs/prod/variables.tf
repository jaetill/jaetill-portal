variable "project_name" {
  type        = string
  description = "Project slug used in tags and resource names."
  default     = "jaetill-portal"
}

variable "env" {
  type        = string
  description = "Deployment environment label."
  default     = "prod"
}

variable "aws_region" {
  type        = string
  description = "AWS region for this environment."
  default     = "us-east-2"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID."
  default     = "214599503944"
}

variable "cloudfront_acm_cert_arn" {
  type        = string
  description = "ACM certificate ARN for jaetill.com (must be in us-east-1 for CloudFront)."
  default     = "arn:aws:acm:us-east-1:214599503944:certificate/52f6b6b2-be6e-4643-8522-2df0e1e3632a"
}