# Production environment for jaetill-portal.
# Phase 6 retrofit per platform ADR-0007. Slice 1 (S3 + CloudFront) ready.
# Subsequent slices (Lambda invite, IAM, API Gateway) documented in terraform/README.md.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}