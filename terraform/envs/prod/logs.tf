# Slice 5: CloudWatch log groups (no secrets; project uses shared/postmark via data source)

resource "aws_cloudwatch_log_group" "invite" {
  name              = "/aws/lambda/jaetill-portal-invite"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}