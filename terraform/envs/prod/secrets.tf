# GitHub PAT for feedback Lambda - value set externally via aws CLI:
#   aws secretsmanager put-secret-value --secret-id jaetill-portal/github-token \
#     --secret-string '{"GITHUB_TOKEN":"ghp_..."}'
# PAT needs: issues:write on jaetill/jaetill-portal.
resource "aws_secretsmanager_secret" "github_token" {
  name        = "jaetill-portal/github-token"
  description = "GitHub PAT for feedback Lambda to file user-feedback issues"
}