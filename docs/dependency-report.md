## Dependency Watch (2026-07-06)

---

### `package.json` (root — frontend / Vite build)

**Security audit:** No vulnerabilities found (0 prod advisories).

#### Minor/patch updates (low priority — batch in monthly sweep)

| Package | Installed | Latest | Notes |
|---|---|---|---|
| `@sentry/browser` | 10.53.1 | 10.63.0 | Minor bump within v10; no breaking changes expected |

---

### `lambda/package.json` (Lambda — invite handler)

**Security audit:** 18 moderate advisories.

#### Moderate security advisories (update recommended)

| Advisory | Package | Severity | CVSS | Fix |
|---|---|---|---|---|
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | `@opentelemetry/core` (transitive via `@sentry/aws-serverless`) | Moderate | 5.3 | Upgrade `@sentry/aws-serverless` to `^10.63.0` |

**Root cause:** `@sentry/aws-serverless@9.47.1` pulls in `@opentelemetry/core <2.8.0`, which has an unbounded memory allocation vulnerability in W3C Baggage propagation (CWE-770). The 18 reported entries are all downstream instrumentation packages that share the same root cause.

**Fix:** Bump `@sentry/aws-serverless` from `^9.0.0` → `^10.0.0` in `lambda/package.json`. This is a **major version bump (9→10)** — review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/migration/v9-to-v10/) for breaking changes before updating. The Lambda handler in `lambda/invite.js` should be audited for any deprecated SDK APIs.

#### Major version bumps available (note — breaking-change risk)

| Package | Installed | Latest | Breaking-change risk |
|---|---|---|---|
| `@sentry/aws-serverless` | 9.47.1 | 10.63.0 | **Required for the security fix above.** v10 drops some deprecated APIs; see migration guide. |
| `@octokit/rest` | 21.1.1 | 22.0.1 | Major bump; review [Octokit v22 changelog](https://github.com/octokit/rest.js/releases) for removed/renamed methods before updating. No known security advisory. |

---

### Summary

| Severity | Count | Action |
|---|---|---|
| Critical/High security | 0 | — |
| Moderate security | 18 (root: 1 advisory) | Update `@sentry/aws-serverless` 9→10 in `lambda/`; major bump, review migration guide |
| Major version bump | 2 | `@sentry/aws-serverless` 9→10 (security-driven), `@octokit/rest` 21→22 (no CVE) |
| Minor/patch bump | 1 | `@sentry/browser` 10.53→10.63 in root; batch with monthly sweep |
