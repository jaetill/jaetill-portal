# Terraform — jaetill-portal production environment

Phase 6 IaC retrofit per platform ADR-0007. Imports existing AWS infrastructure into Terraform state.

## Slice 1 (S3 + CloudFront) — ready to plan and apply

Files: `s3.tf`, `cloudfront.tf`, with import blocks in `imports.tf`.

### Workflow

```sh
cd terraform/envs/prod
tofu init
tofu plan -out slice1.plan   # ACM cert ARN is in variables.tf default
tofu apply slice1.plan
```

Then remove the `import` blocks from `imports.tf`.

## Remaining slices

### Slice 2 — IAM (deploy role + Lambda execution role)

```sh
aws iam list-roles --query "Roles[?contains(RoleName, 'jaetill-portal') || contains(RoleName, 'invite')].RoleName"
```

### Slice 3 — Lambda function (`jaetill-portal-invite`)

```sh
aws lambda get-function --function-name jaetill-portal-invite --region us-east-2
```

Per the game-night-pwa pattern, add `lifecycle { ignore_changes = [filename, source_code_hash, last_modified, environment.0.variables] }`.

### Slice 4 — API Gateway (the route that invokes invite.js)

```sh
aws apigatewayv2 get-apis --region us-east-2 --query "Items[?contains(Name, 'portal') || contains(Name, 'invite')]"
# Inspect any matching API + its routes/integrations
```

### Slice 5 — Secrets Manager (Postmark API key, shared)

```sh
aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'postmark') || contains(Name, 'portal')].Name"
```

## State key

`s3://jaetill-tfstate/jaetill-portal/prod/terraform.tfstate`
