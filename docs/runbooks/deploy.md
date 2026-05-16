# Deploy

Portal deploys via CLI, not GitHub Actions. `.github/workflows/deploy.yml` runs on push to `main` but the Lambda update step is currently manual. Phase 4 of platform adoption will add release tracking; Phase 5 will add observability tied to releases.

## Prerequisites

- `gh` authenticated against `jaetill/jaetill-portal`
- `aws` configured for the account that hosts the S3 bucket, CloudFront distribution, and Lambda
- `npm install --legacy-peer-deps` succeeds locally (Vite 8 + `@tailwindcss/vite` peer mismatch)

## Frontend deploy

```sh
npm install --legacy-peer-deps
npm run build

# Sync built assets to S3 (CloudFront origin)
aws s3 sync dist/ s3://<bucket>/ --delete

# Invalidate the entry HTML files only - assets are cache-busted by Vite
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/index.html" "/callback.html"
```

**Do NOT use `--delete` on a bucket that holds anything besides build output.** Portal's bucket is build-only, so it is safe here. Sibling apps (meal-planner) share their bucket with user data and must omit `--delete`.

## Lambda deploy

```sh
cd lambda
zip -r invite.zip invite.js                          # no runtime deps beyond AWS SDK
aws lambda update-function-code \
  --function-name <function-name> \
  --zip-file fileb://invite.zip
```

Function name and ARN are documented in the AWS console; not yet captured here pending Phase 6 (IaC retrofit) when they will be source-controlled.

## Rollback

Frontend: re-sync the previous Git-tagged commit's `dist/` output. The S3 bucket has versioning enabled (verify before relying on this).

Lambda: re-zip the previous `lambda/invite.js` content and re-upload. AWS Lambda keeps prior versions for ~90 days by default if versioning is enabled on the function.

## Future work

- Phase 4: `release.yml` (release-please) tags releases on master, opens release PRs
- Phase 5: `deploy.yml` augmented with Sentry release tracking
- Phase 6: API Gateway, Lambda, IAM role under OpenTofu management with state in S3