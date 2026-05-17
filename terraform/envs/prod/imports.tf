# Phase 6 Slice 1 import blocks — S3 only.
# CloudFront imports deferred behind IAM gap — see cloudfront.tf.pending.
# Fix: `aws iam put-user-policy --user-name jaetill-dev --policy-name TerraformCloudFront --policy-document '...'`

import {
  to = aws_s3_bucket.main
  id = "jaetill-portal"
}

import {
  to = aws_s3_bucket_policy.main
  id = "jaetill-portal"
}

# Pending IAM fix:
# import {
#   to = aws_cloudfront_origin_access_control.main
#   id = "E209SBSPLCBS9N"
# }
#
# import {
#   to = aws_cloudfront_distribution.main
#   id = "E3L96MPPOA7GTI"
# }