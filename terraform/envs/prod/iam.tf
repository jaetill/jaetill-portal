# Slice 2: IAM
#
# 2 roles:
#   - jaetill-portal-invite-role     (Lambda execution role)
#   - jaetill-portal-github-deploy   (OIDC trust for GitHub Actions)

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── invite Lambda execution role ─────────────────────────────────────────

resource "aws_iam_role" "invite" {
  name               = "jaetill-portal-invite-role"
  description        = "Execution role for jaetill-portal-invite Lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role_policy_attachment" "invite_basic_exec" {
  role       = aws_iam_role.invite.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "invite_cognito_admin" {
  name = "cognito-admin"
  role = aws_iam_role.invite.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CognitoAdminScoped"
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListUsers",
        ]
        Resource = "arn:aws:cognito-idp:${var.aws_region}:${var.aws_account_id}:userpool/us-east-2_xneeJzaDJ"
      }
    ]
  })
}

resource "aws_iam_role_policy" "invite_nudge_extras" {
  name = "nudge-extras"
  role = aws_iam_role.invite.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowAdminSetUserPasswordOnSharedPool"
        Effect   = "Allow"
        Action   = "cognito-idp:AdminSetUserPassword"
        Resource = "arn:aws:cognito-idp:${var.aws_region}:${var.aws_account_id}:userpool/us-east-2_xneeJzaDJ"
      },
      {
        Sid      = "AllowReadPostmarkSecret"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:shared/postmark-api-key*"
      }
    ]
  })
}

# ── GitHub Actions OIDC deploy role ──────────────────────────────────────

resource "aws_iam_role" "github_deploy" {
  name        = "jaetill-portal-github-deploy"
  description = "OIDC role for jaetill-portal GitHub Actions deploys"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = "arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com" }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:jaetill/jaetill-portal:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3DeploySync"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::jaetill-portal",
          "arn:aws:s3:::jaetill-portal/*",
        ]
      },
      {
        Sid      = "CloudFrontInvalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "arn:aws:cloudfront::${var.aws_account_id}:distribution/E3L96MPPOA7GTI"
      }
    ]
  })
}