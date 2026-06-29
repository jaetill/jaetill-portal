## Dependency Watch (2026-06-29)

---

### `package.json` (root — frontend / build tooling)

#### Minor/patch updates available (low priority — batch in monthly sweep)

| Package | Installed | Available | Notes |
|---|---|---|---|
| `@sentry/browser` | `^10.53.1` (resolves 10.53.1) | `10.62.0` | Minor bump within 10.x; no breaking changes expected |

#### Security audit

No production vulnerabilities found (`npm audit --omit=dev`).

---

### `lambda/package.json` (Lambda — invite handler)

#### MODERATE security advisories — upgrade required

**Root cause:** `@sentry/aws-serverless@9.x` ships `@opentelemetry/core <2.8.0`, which has an unbounded-memory-allocation vulnerability in W3C Baggage propagation.

| Advisory | Severity | CVSS | Affected package | Fix |
|---|---|---|---|---|
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | Moderate | 5.3 | `@opentelemetry/core <2.8.0` | Upgrade `@sentry/aws-serverless` to `^10.62.0` |

**Affected transitive packages (18 total):** `@opentelemetry/core`, `@opentelemetry/instrumentation-{amqplib,aws-sdk,connect,express,fs,hapi,http,koa,mongoose,mysql2,pg,undici}`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sql-common`, `@sentry/node`.

**Recommended action:** Bump `@sentry/aws-serverless` from `^9.0.0` → `^10.62.0` in `lambda/package.json`. This is a **major version bump** — review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/guides/aws-lambda/) for breaking changes before merging.

#### Major version bumps available (note — breaking-change risk)

| Package | Pinned range | Current wanted | Latest | Risk |
|---|---|---|---|---|
| `@sentry/aws-serverless` | `^9.0.0` | `9.47.1` | `10.62.0` | **Major** — also fixes the OTEL advisory above |
| `@octokit/rest` | `^21.0.0` | `21.1.1` | `22.0.1` | **Major** — review [Octokit v22 changelog](https://github.com/octokit/rest.js/releases) for API changes |

#### Minor/patch updates available (low priority — batch in monthly sweep)

None beyond what is captured in the major bumps above.

---

### Summary

| Manifest | Critical | High | Moderate | Major bumps | Minor/patch |
|---|---|---|---|---|---|
| `package.json` (root) | 0 | 0 | 0 | 0 | 1 |
| `lambda/package.json` | 0 | 0 | 18 | 2 | 0 |

**Immediate action required:** Upgrade `@sentry/aws-serverless` to `^10.62.0` in `lambda/package.json` to resolve 18 moderate OpenTelemetry advisories (GHSA-8988-4f7v-96qf). This upgrade is a major version bump; validate Lambda behaviour in a non-production environment first.
