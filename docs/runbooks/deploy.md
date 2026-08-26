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

`invite.js` requires `./lib/sentry`, which requires `@sentry/aws-serverless`. A
single-file zip therefore **fails at cold start with `MODULE_NOT_FOUND`** — the
package must carry `lib/` and `node_modules/` alongside the handler.

```sh
cd lambda && npm install && cd ..

# Windows' Compress-Archive writes backslash entry names that the Linux Lambda
# runtime cannot resolve. build/zip.py writes POSIX paths.
python build/zip.py lambda/invite.zip lambda/invite.js lambda/lib lambda/node_modules

aws lambda update-function-code \
  --function-name jaetill-portal-invite \
  --region us-east-2 \
  --zip-file fileb://lambda/invite.zip
aws lambda wait function-updated \
  --function-name jaetill-portal-invite --region us-east-2
```

Package is ~14 MB / ~6,500 entries — within the 50 MB direct-upload limit.
Cold start with Sentry + OpenTelemetry loaded is ~1.0 s init / ~123 MB peak
against a 10 s timeout and 256 MB allocation.

### Smoke test

The handler gates on `admins` in the caller's claims, so a direct invoke needs a
synthetic event. A lookup for a nonexistent user exercises module load, the
authz check, and a real Cognito call without side effects — expect HTTP 404.

```sh
cat > /tmp/evt.json <<'JSON'
{"httpMethod":"POST",
 "requestContext":{"authorizer":{"claims":{"cognito:groups":"[admins]"}}},
 "body":"{\"action\":\"nudge\",\"email\":\"no-such-user@example.invalid\"}"}
JSON
aws lambda invoke --function-name jaetill-portal-invite --region us-east-2 \
  --payload fileb:///tmp/evt.json /tmp/out.json && cat /tmp/out.json
```

Do **not** smoke-test with a real address — `action: nudge` resets that user's
temporary password and emails them.

## Rollback

Frontend: re-sync the previous Git-tagged commit's `dist/` output. The S3 bucket has versioning enabled (verify before relying on this).

Lambda: before any deploy, snapshot the live package so rollback needs no rebuild:

```sh
url=$(aws lambda get-function --function-name jaetill-portal-invite \
  --region us-east-2 --query 'Code.Location' --output text)
curl -o invite-BACKUP.zip "$url"
```

Roll back by re-uploading that zip with `update-function-code`.

## Future work

- Phase 4: `release.yml` (release-please) tags releases on master, opens release PRs
- Phase 5: `deploy.yml` augmented with Sentry release tracking
- Phase 6: API Gateway, Lambda, IAM role under OpenTofu management with state in S3
