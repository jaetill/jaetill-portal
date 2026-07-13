## Dependency Watch (2026-07-13)

### Root — `package.json` (`jaetill-portal`)

#### Moderate / Minor bumps available

| Package | Current | Wanted | Latest | Kind |
|---|---|---|---|---|
| `@sentry/browser` | ~10.53.1 | 10.65.0 | 10.65.0 | minor |

**Risk:** Minor release within the same major; no breaking changes expected. Batch into monthly sweep.

#### Security advisories

None. `npm audit --omit=dev` reports 0 vulnerabilities across 7 production dependencies.

---

### Lambda — `lambda/package.json` (`jaetill-portal-lambdas`)

#### Moderate security advisory — action recommended

| Package | Current | Fix version | CVE / Advisory | Severity | CVSS |
|---|---|---|---|---|---|
| `@sentry/aws-serverless` (via `@opentelemetry/core`) | 9.x | 10.65.0 | [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | Moderate | 5.3 |

`npm audit` reports **18 moderate findings**, all rooted in the same vulnerability:

> **OpenTelemetry Core: Unbounded memory allocation in W3C Baggage propagation** (`@opentelemetry/core < 2.8.0`, CWE-770).  
> A remote unauthenticated attacker can send a crafted HTTP request with a large `baggage` header, causing unbounded memory allocation and potential DoS.

`@sentry/aws-serverless ≤ 9.47.1` bundles `@opentelemetry/core < 2.8.0` transitively. The fix requires upgrading `@sentry/aws-serverless` to **10.65.0**, which is a **major version bump** (9 → 10). Review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/migration/v9-to-v10/) for breaking changes before updating.

**Recommended action:** Upgrade `@sentry/aws-serverless` to `^10.0.0` in `lambda/package.json`, validate the Lambda handler still initialises correctly, then redeploy.

#### Major version bump available

| Package | Current range | Latest major | Breaking-change risk |
|---|---|---|---|
| `@octokit/rest` | `^21.0.0` (resolved 21.1.1) | 22.0.1 | Medium — review changelog; REST client interface changes between majors |
| `@sentry/aws-serverless` | `^9.0.0` (resolved 9.47.1) | 10.65.0 | Medium — see security item above; upgrade is also needed for the audit fix |

Both major bumps warrant a read of the respective changelogs before merging. `@octokit/rest` v22 carries no known security advisory; it can be scheduled in the next planned maintenance window.

#### Minor/patch bumps available

None beyond the major versions noted above.

---

### Summary

| Severity | Count | Action |
|---|---|---|
| CRITICAL / HIGH security | 0 | — |
| Moderate security (audit) | 18 (one root cause) | Upgrade `lambda/` `@sentry/aws-serverless` → `^10.0.0` |
| Major version bump | 2 | Schedule: `@sentry/aws-serverless` (tied to audit fix), `@octokit/rest` (next maintenance) |
| Minor / patch bump | 1 | Batch in monthly sweep: root `@sentry/browser` |
