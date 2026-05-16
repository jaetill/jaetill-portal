# jaetill-portal

Single-page launcher at `jaetill.com`. Sign in once via Cognito Hosted UI; tiles for meal-planner, game-night, carto, and other sibling apps you have access to. Cross-app session is shared at `just.jaetill.com` via Cognito App Clients so sibling apps auto-sign-in.

## Stack

- **Frontend:** Vite + Tailwind 4 SPA (vanilla JS)
- **Backend:** API Gateway -> Node.js Lambda (`lambda/invite.js`) for admin operations
- **Auth:** Shared Cognito user pool, hosted UI at `just.jaetill.com`
- **Email:** Postmark for invite + nudge emails (from `jason@jaetill.com`)
- **Hosting:** S3 + CloudFront, deploys CLI-only (see [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md))

## Platform inheritance

Subscribes to the [Agentic Dev Environment](https://github.com/jaetill/agentic-dev-environment) platform per [ADR-0001](docs/adr/0001-platform-adoption.md). The platform ships the `ai-team` plugin (agents, commands, hooks, skills); this project carries only the marketplace subscription, the permissions block, and its own deviations.

## Development

```sh
npm install --legacy-peer-deps   # Vite 8 + Tailwind 4 peer-range workaround
npm run dev                       # http://localhost:5173
npm run build                     # -> dist/
```

## Deploy

CLI-only currently. See [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md) for the S3 + CloudFront + `aws lambda update-function-code` recipe.