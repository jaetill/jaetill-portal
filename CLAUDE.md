# jaetill-portal — CLAUDE.md

## What it does
Single-page launcher at the apex `jaetill.com`. Users sign in once via Cognito Hosted UI (OAuth 2.0 Authorization Code + PKCE) and see tiles for every app on jaetill.com they have access to. Once signed in at the portal, the Cognito session cookie at `just.jaetill.com` lets the sibling apps (meal-planner, game-night, carto) auto-sign-in via their own App Clients — no second prompt.

## Tech stack & hosting
| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vite + Tailwind v4 + vanilla JS | Two HTML entries: `index.html` (launcher) and `callback.html` (OAuth code exchange) |
| Auth | Cognito Hosted UI, OAuth 2.0 Authorization Code + PKCE | Hand-rolled with Web Crypto API and `fetch` — no `aws-amplify` dependency |
| Authz | Cognito Groups + per-app `groups` filter in `apps.js` | Each app has a group (`meal-planner-users`, `game-night-users`, `carto-users`); the launcher hides tiles whose group the user is not in. `admins` group unlocks the in-portal invite UI |
| Backend | One Lambda (`jaetill-portal-invite`) behind a REST API Gateway | Admin-only endpoint for creating users + adding them to app groups |
| Storage | None at runtime | Tokens in `localStorage`; no app data |
| Hosting | S3 (`jaetill-portal`) + CloudFront via OAC | Apex `jaetill.com` A-alias to CloudFront |
| Deploy | GitHub Actions (OIDC) | Role: `jaetill-portal-github-deploy` |

## AWS resources
| Resource | ID / ARN | Region | Notes |
|---|---|---|---|
| S3 Bucket | `jaetill-portal` | us-east-2 | Public access blocked; CloudFront OAC only |
| CloudFront Distribution | `E3L96MPPOA7GTI` (`d157xe4inmrlqc.cloudfront.net`) | global | Apex `jaetill.com` + `www.jaetill.com` |
| CloudFront OAC | `E209SBSPLCBS9N` (`jaetill-portal-oac`) | global | Locks bucket reads to this distribution |
| ACM Cert (CloudFront) | `arn:aws:acm:us-east-1:214599503944:certificate/52f6b6b2-be6e-4643-8522-2df0e1e3632a` | us-east-1 | SANs: `jaetill.com`, `www.jaetill.com` |
| ACM Cert (Cognito domain) | `arn:aws:acm:us-east-1:214599503944:certificate/b8a55dda-3de1-433d-aa8c-e3c676af8672` | us-east-1 | SAN: `just.jaetill.com` |
| Cognito User Pool | `us-east-2_xneeJzaDJ` | us-east-2 | **Shared** with meal-planner and game-night |
| Cognito Custom Domain | `just.jaetill.com` (managed login v2) | us-east-2 | Hosted UI — `https://just.jaetill.com/login?...` |
| Cognito App Client (portal) | `46otpmd24oi6mul3seod77b2k0` | us-east-2 | Public client (no secret), PKCE only |
| Cognito branding (portal client) | `79ecbd8d-a55f-4e23-9e61-5dbabf6ce9bc` | us-east-2 | Default-values managed-login branding; required for Hosted UI to render |
| Cognito Groups | `meal-planner-users`, `game-night-users`, `carto-users`, `admins` | us-east-2 | Membership-based authz; claim flows in `cognito:groups` |
| API Gateway (REST) | `eqidhh18u2` (`https://eqidhh18u2.execute-api.us-east-2.amazonaws.com/prod`) | us-east-2 | Cognito User Pool authorizer (`l6sj74`) on POST /invite |
| Lambda | `jaetill-portal-invite` | us-east-2 | Admin invite handler — see `lambda/invite.js` |
| Lambda execution role | `jaetill-portal-invite-role` | us-east-2 | CloudWatch Logs + scoped Cognito admin ops on the shared pool |
| GitHub OIDC Role | `jaetill-portal-github-deploy` | us-east-2 | Trust scoped to `repo:jaetill/jaetill-portal:ref:refs/heads/master`. **Note:** does not yet include `lambda:UpdateFunctionCode` perms — Lambda updates are CLI-only until the role is extended |
| Route 53 records | A-alias `jaetill.com` → CloudFront | global | CloudFront hosted zone `Z2FDTNDATAQYW2` |
| Route 53 records | A-alias `just.jaetill.com` → Cognito alias target | global | AWS provides alias target on custom-domain creation |

## Frontend source map
| File | Purpose |
|---|---|
| `index.html` | Launcher entry — empty `<div id="app">` shell, JS renders tiles |
| `callback.html` | OAuth redirect target — exchanges code for tokens, redirects to `/` |
| `src/js/main.js` | App shell — auth gate, render sign-in or launcher |
| `src/js/auth.js` | PKCE flow — verifier/challenge generation, redirect, code exchange, refresh, logout, JWT decode |
| `src/js/callback.js` | Calls `handleCallback()`, redirects to `/` on success |
| `src/js/apps.js` | Static app catalog + group-based filter — each app entry has a `groups: [...]` field that matches Cognito group names |
| `src/js/passkey.js` | Direct WebAuthn API calls against Cognito (StartWebAuthnRegistration / List / Delete) |
| `src/js/config.js` | Cognito domain, client ID, redirect/logout URIs, scopes, `API_BASE` for the invite Lambda |
| `lambda/invite.js` | Admin invite handler — creates user (idempotent) + adds to selected groups |
| `src/style.css` | Tailwind entry (`@import "tailwindcss";`) |

## API routes
| Method | Path | Auth | Lambda | Purpose |
|---|---|---|---|---|
| POST | /invite | Cognito JWT (caller must be in `admins` group) | jaetill-portal-invite | Create user (or no-op) + add them to one or more app groups; Cognito sends invitation email |
| OPTIONS | /invite | None | jaetill-portal-invite | CORS preflight (Lambda returns headers) |

## Environment variables
Frontend Cognito config is non-secret and hardcoded in `src/js/config.js`.

| Variable | Where it lives | Purpose |
|---|---|---|
| `AWS_ROLE_ARN` | GitHub repo secret | OIDC role assumed by GitHub Actions for S3 + CloudFront deploy |
| `USER_POOL_ID` | Lambda env var on `jaetill-portal-invite` | Shared pool ID |
| `REGION` | Lambda env var on `jaetill-portal-invite` | `us-east-2` |
| `ALLOWED_ORIGIN` | Lambda env var on `jaetill-portal-invite` | `https://jaetill.com` (CORS) |

## Auth & user model

**Flow** (Authorization Code + PKCE):
1. Hit `jaetill.com` → `auth.js` checks `isAuthenticated()`
2. Not signed in → click sign-in → generate PKCE verifier + state, redirect to `https://just.jaetill.com/oauth2/authorize?...`
3. User signs in (passkey preferred, TOTP fallback, federated Google optional — all configured at the User Pool level)
4. Cognito redirects to `https://jaetill.com/callback.html?code=...&state=...`
5. `callback.js` validates state, POSTs `{ code, code_verifier }` to `/oauth2/token`, stores tokens in `localStorage`, redirects to `/`
6. Tile click → external app — that app sees the Cognito session cookie at `just.jaetill.com` and auto-signs-in via its own App Client

**Tokens** (`localStorage`):
| Key | Value |
|---|---|
| `jp.id.token` | OIDC ID token (claims for username display) |
| `jp.access.token` | Access token (unused by portal today; reserved for future API calls) |
| `jp.refresh.token` | Refresh token (used by `auth.js refresh()`) |
| `jp.expires.at` | Epoch ms expiry of access token |

**Cognito App Client config (portal):**
- Allowed OAuth flows: Authorization code grant
- Allowed OAuth scopes: `openid`, `email`, `profile`, `aws.cognito.signin.user.admin` (the last one is required for the portal to call access-token-authenticated user-pool ops like `StartWebAuthnRegistration`, `ListWebAuthnCredentials`, etc. — without it Cognito returns "Access Token does not have required scopes")
- Callback URLs: `https://jaetill.com/callback.html`, `http://localhost:5173/callback.html`
- Sign-out URLs: `https://jaetill.com/`, `http://localhost:5173/`
- **No client secret** — public SPA client; PKCE replaces the secret
- Refresh token expiration: 30 days; Access/ID token expiration: 1 hour

**MFA:** Configured at the User Pool level — passkeys (WebAuthn) preferred, TOTP fallback, SMS disabled.

## Deployment
1. Push to `master` triggers `.github/workflows/deploy.yml`
2. `npm ci && npm run build` → output in `dist/`
3. S3 sync HTML with `no-cache`, assets with `max-age=31536000, immutable`
4. CloudFront invalidation on `/index.html` and `/callback.html`

**Gotchas:**
- **Managed Login v2 requires per-client branding** — without `aws cognito-idp create-managed-login-branding --client-id <id> --use-cognito-provided-values`, the Hosted UI shows "Login pages unavailable. Please contact an administrator." The portal's branding ID is `79ecbd8d-a55f-4e23-9e61-5dbabf6ce9bc`. Every new App Client on this pool that uses Hosted UI needs its own branding entry.
- Apex `jaetill.com` requires the ACM cert to cover the apex literally — `*.jaetill.com` does NOT cover `jaetill.com`. Issue with both `jaetill.com` and `www.jaetill.com` SANs.
- Cognito custom domains require an A record on the parent (`jaetill.com`) to exist *before* `create-user-pool-domain` will accept a subdomain — chicken-and-egg with CloudFront. Create the distribution + apex A-alias first, then the Cognito domain.
- CloudFront requires its ACM cert in **us-east-1**, even though the bucket is in us-east-2.
- Cognito custom domain (`just.jaetill.com`) ALSO requires the ACM cert in us-east-1.
- Apex DNS must be an **A alias** to CloudFront (CNAMEs at apex are invalid).
- `CallbackURLs` and `LogoutURLs` on the App Client must match exactly — `https://jaetill.com/` ≠ `https://jaetill.com`.
- **Never use `--delete`** on `aws s3 sync` — pattern matches sibling apps that store data in their buckets.
- Adding a new app to the launcher requires editing `src/js/apps.js` only — no infrastructure change.

## Local dev
```bash
npm install
npm run dev      # → http://localhost:5173
```
The App Client must include `http://localhost:5173/callback.html` in its callback URLs and `http://localhost:5173/` in its sign-out URLs.

## Provisioning checklist (one-time, AWS not yet provisioned)
1. Request ACM cert in **us-east-1** for SANs `jaetill.com`, `www.jaetill.com`. Validate via DNS in Route 53.
2. Request ACM cert in **us-east-1** for SAN `just.jaetill.com`. Validate via DNS.
3. Create S3 bucket `jaetill-portal` (us-east-2), block all public access.
4. Create CloudFront distribution: bucket origin via OAC; aliases `jaetill.com`, `www.jaetill.com`; cert from step 1; default root `index.html`; custom error response 403→200 `/index.html` (SPA fallback).
5. Update bucket policy to allow CloudFront OAC read scoped to the new distribution ARN.
6. Set up Cognito custom domain `just.jaetill.com` on pool `us-east-2_xneeJzaDJ` with cert from step 2. Add A-alias record for the returned alias target.
7. Create Cognito App Client (no secret) with PKCE, callback/signout URLs above, scopes `openid email profile`.
8. Enable WebAuthn (passkeys) and TOTP MFA on the User Pool. Disable SMS.
9. Create OIDC role `jaetill-portal-github-deploy` scoped to `repo:jaetill/jaetill-portal:ref:refs/heads/master`. Permissions: `s3:PutObject/DeleteObject/ListBucket` on `jaetill-portal`, `cloudfront:CreateInvalidation` on this distribution.
10. Add `AWS_ROLE_ARN` GitHub secret on the new repo.
11. Add bucket to `jaetill-dev-s3` managed policy (local CLI dev).
12. Route 53 A-aliases: `jaetill.com` + `www.jaetill.com` → CloudFront; `just.jaetill.com` → Cognito alias target.
13. Replace placeholders in `src/js/config.js` (`clientId`) and `.github/workflows/deploy.yml` (`distribution-id`).

## Quirks & notes
- **No `aws-amplify` dependency** — PKCE flow is hand-rolled (~150 lines, Web Crypto API). Avoids ~500 KB of Amplify, smaller attack surface, easier to audit. The trade-off is more bespoke code; mitigated by the simplicity of the flow.
- Tokens stored in `localStorage` (not `sessionStorage`) so a refresh keeps the user signed in. Trade-off: XSS exfiltration risk. Mitigations: portal renders no user-supplied HTML, no third-party scripts. **TODO:** add a strict CSP via CloudFront response-headers policy.
- The portal does NOT use Cognito groups today — every authenticated user sees every app. `apps.js` has a placeholder `appsForUser(claims)` that can filter by `claims['cognito:groups']` once group-based access lands.
- Game-night currently lives on GitHub Pages, not a CloudFront subdomain. The tile URL is a placeholder until game-night moves under jaetill.com or we link directly to the github.io URL.
- ai-teacher is intentionally **not** in the launcher — it uses direct Google OAuth (Drive/Classroom scopes) and is scoped to a different user (Heidi). Adding it would weaken the SSO story.


---

## Platform inheritance

This project adopts the [Agentic Dev Environment](https://github.com/jaetill/agentic-dev-environment) platform per [ADR-0001](docs/adr/0001-platform-adoption.md). The platform's 11 standards (in [`docs/standards/`](https://github.com/jaetill/agentic-dev-environment/tree/main/docs/standards) of the workspace repo) define how this project is operated. Project-specific deviations are documented in ADR-0001.

### AI configuration

The platform's subagents, slash commands, and platform hooks are delivered via the `ai-team` plugin subscription (per workspace ADR-0015). `.claude/settings.json` retains only the plugin subscription (`enabledPlugins`), the permissions block, and `extraKnownMarketplaces` pointing at the workspace's GitHub source. Hook scripts, agent definitions, and commands are NOT committed locally - they ship via the plugin. The existing `.claude/settings.local.json` (gitignored) remains untouched.