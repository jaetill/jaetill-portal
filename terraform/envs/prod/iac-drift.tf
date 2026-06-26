# ADR-0035 / issue #297 — read-only OIDC role for the iac-additive-guard.
#
# Plans terraform/envs/prod on PRs (and is available for a future drift
# detector) under a NARROW per-service introspect policy + tfstate read. Trust
# gates assume-role on this repo's GitHub OIDC for the default branch (main)
# and pull_request. Created out-of-band 2026-06-05 (platform #280) and imported
# here so it is Terraform-managed.
#
# SCOPE (issue #297): the AWS-managed ReadOnlyAccess policy was REMOVED and
# replaced by the narrow inline `iac_drift_introspect` policy below (per-service
# Describe/Get/List only), matching game-night-pwa's reference iac_drift role
# (issue #48). ReadOnlyAccess granted ~41 data-exfil content reads (s3:GetObject
# on every bucket, dynamodb:Scan, etc.) that a refresh-only plan never needs.
# Intentional omissions (security goals, not gaps): secretsmanager:GetSecretValue,
# ssm:GetParameter*, s3:GetObject (outside tfstate), s3:ListBucket (outside
# tfstate), iam:GetAccountAuthorizationDetails (bulk account recon).

resource "aws_iam_role" "iac_drift" {
  name               = "jaetill-portal-iac-drift"
  assume_role_policy = data.aws_iam_policy_document.iac_drift_trust.json
  description        = "Read-only OIDC role for the ADR-0035 iac-additive-guard (plan PR branches). Trusts main + pull_request."
}

data "aws_iam_policy_document" "iac_drift_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:jaetill/jaetill-portal:ref:refs/heads/main",
        "repo:jaetill/jaetill-portal:pull_request",
      ]
    }
  }
}

# Narrow introspect policy (issue #297). Grants only the read actions a
# refresh-only `tofu plan` needs across the services this stack manages:
# IAM, Lambda, API Gateway, CloudFront, S3 (metadata only), Secrets Manager
# (metadata only), CloudWatch/Logs. Modeled on game-night-pwa's iac_drift
# introspect policy (#48); CloudFront statement mirrors carto's (this stack,
# unlike game-night, manages a CloudFront distribution).
data "aws_iam_policy_document" "iac_drift_introspect" {
  statement {
    sid    = "IAMRead"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRoles",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicies",
    ]
    resources = ["*"]
  }
  statement {
    sid    = "LambdaRead"
    effect = "Allow"
    actions = [
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:GetPolicy",
      "lambda:ListFunctions",
      "lambda:ListAliases",
      "lambda:ListVersionsByFunction",
      "lambda:ListEventSourceMappings",
    ]
    resources = ["*"]
  }
  statement {
    sid       = "ApiGwRead"
    effect    = "Allow"
    actions   = ["apigateway:GET"]
    resources = ["*"]
  }
  statement {
    sid    = "CloudFrontRead"
    effect = "Allow"
    actions = [
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:GetOriginAccessControl",
      "cloudfront:GetOriginAccessControlConfig",
      "cloudfront:ListTagsForResource",
    ]
    resources = ["*"]
  }
  statement {
    sid    = "S3MetadataRead"
    effect = "Allow"
    actions = [
      "s3:GetBucket*",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:GetReplicationConfiguration",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetBucketOwnershipControls",
      "s3:ListAllMyBuckets",
    ]
    resources = ["*"]
  }
  statement {
    sid    = "SecretsManagerMetadataOnly"
    effect = "Allow"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecrets",
      "secretsmanager:GetResourcePolicy",
    ]
    resources = ["*"]
  }
  statement {
    sid       = "CloudWatchRead"
    effect    = "Allow"
    actions   = ["cloudwatch:Describe*", "cloudwatch:List*", "logs:Describe*"]
    resources = ["*"]
  }
  statement {
    sid       = "StsIdentity"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "iac_drift_introspect" {
  name   = "introspect"
  role   = aws_iam_role.iac_drift.id
  policy = data.aws_iam_policy_document.iac_drift_introspect.json
}

data "aws_iam_policy_document" "iac_drift_tfstate" {
  statement {
    sid       = "TFStateRead"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = ["arn:aws:s3:::jaetill-tfstate", "arn:aws:s3:::jaetill-tfstate/*"]
  }
  statement {
    sid       = "TFStateLock"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/terraform-state-lock"]
  }
}

resource "aws_iam_role_policy" "iac_drift_tfstate" {
  name   = "tfstate-access"
  role   = aws_iam_role.iac_drift.id
  policy = data.aws_iam_policy_document.iac_drift_tfstate.json
}
