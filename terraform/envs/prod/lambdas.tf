# jaetill-portal-invite Lambda - admin tool to invite users to apps via Cognito.
# Note: SENTRY_DSN env var not yet set on the function; Phase 5 SDK wired but DSN missing.

resource "aws_lambda_function" "invite" {
  function_name = "jaetill-portal-invite"
  role          = aws_iam_role.invite.arn
  handler       = "invite.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 256
  timeout       = 10

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = {
      USER_POOL_ID   = "us-east-2_xneeJzaDJ"
      ALLOWED_ORIGIN = "https://jaetill.com"
      REGION         = var.aws_region
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}