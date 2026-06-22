## Dependency Watch (2026-06-22)

---

### `package.json` (root — frontend / build tooling)

#### No Security Vulnerabilities

`npm audit --omit=dev` reported 0 vulnerabilities across all production dependencies.

#### Minor / Patch Updates (low priority — batch in monthly sweep)

| Package | Current (declared) | Installed | Latest |
|---|---|---|---|
| `@sentry/browser` | `^10.53.1` | 10.53.1 | 10.59.0 |

`@sentry/browser` 10.53.1 → 10.59.0 is a minor release train bump within the same major. No breaking changes expected.

---

### `lambda/package.json` (Lambda — `jaetill-portal-invite`)

#### Moderate Security Advisories (fix requires major version bump)

**Advisory:** [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) — OpenTelemetry Core: Unbounded memory allocation in W3C Baggage propagation
- **CVSS:** 5.3 (Medium) — `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Vulnerable range:** `@opentelemetry/core < 2.8.0`
- **Root cause:** `@sentry/aws-serverless@9.x` pulls in an old `@opentelemetry/core` (< 2.8.0) transitively via `@sentry/node` and multiple OTel instrumentation packages.
- **Affected transitive packages (18 total):** `@opentelemetry/core`, `@opentelemetry/instrumentation-amqplib`, `@opentelemetry/instrumentation-aws-sdk`, `@opentelemetry/instrumentation-connect`, `@opentelemetry/instrumentation-express`, `@opentelemetry/instrumentation-fs`, `@opentelemetry/instrumentation-hapi`, `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-koa`, `@opentelemetry/instrumentation-mongoose`, `@opentelemetry/instrumentation-mysql2`, `@opentelemetry/instrumentation-pg`, `@opentelemetry/instrumentation-undici`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sql-common`, `@sentry/aws-serverless`, `@sentry/node`
- **Fix:** Upgrade `@sentry/aws-serverless` from `^9.0.0` → `^10.59.0` (semver **major**). `npm audit fix --force` would install `10.59.0` automatically but the `^9.0.0` pin in `package.json` must also be updated.
- **Breaking-change risk:** Sentry v9 → v10 drops some legacy APIs. Review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/node/migration/v9-to-v10/) before upgrading. Impact here is low — `lambda/invite.js` uses only `Sentry.init()` and `Sentry.AWSLambda.wrapHandler()`.

#### Major Version Bumps (note + breaking-change risk)

| Package | Current (declared) | Installed | Latest | Jump |
|---|---|---|---|---|
| `@sentry/aws-serverless` | `^9.0.0` | 9.47.1 | 10.59.0 | 9 → 10 (major) |
| `@octokit/rest` | `^21.0.0` | 21.1.1 | 22.0.1 | 21 → 22 (major) |

- **`@sentry/aws-serverless` 9 → 10:** Also resolves all 18 moderate advisories listed above. Prioritize this upgrade.
- **`@octokit/rest` 21 → 22:** No security advisory. Review the Octokit v22 changelog before upgrading; confirm `createUser` / `addUserToGroup` call signatures are unchanged (they are Cognito SDK calls, not Octokit, so this may be low risk depending on which Octokit endpoints the Lambda uses).

---

### Summary

| Severity | Count | Action |
|---|---|---|
| CRITICAL / HIGH security | 0 | — |
| MODERATE security | 18 (all one root cause) | Upgrade `@sentry/aws-serverless` `^9` → `^10` in `lambda/` |
| Major version available | 2 | `@sentry/aws-serverless`, `@octokit/rest` in `lambda/` |
| Minor / patch available | 1 | `@sentry/browser` in root |

**Recommended immediate action:** Update `lambda/package.json` to pin `@sentry/aws-serverless` at `^10.59.0`, run `npm install` in `lambda/`, validate the Lambda locally (`node lambda/invite.js` smoke test or integration test), then redeploy.
