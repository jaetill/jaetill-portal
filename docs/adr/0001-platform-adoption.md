# ADR-0001: Adopt the Agentic Dev Environment platform

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Jason Tilley
- **Tags:** platform, governance, AI-workflows

## Context and Problem Statement

`jaetill-portal` exists as a working admin/launcher tool (Cognito Hosted UI integration, `lambda/invite.js` for user invites and FORCE_CHANGE_PASSWORD re-nudges) but has not yet adopted the same engineering standards as the other `jaetill.com` apps (game-night-pwa, meal-planner, ai-teacher). Without those standards, every change risks losing the consistency that made it cheap to reason about each app.

This ADR records the decision to adopt the Agentic Dev Environment platform and lists the project-specific deviations from platform defaults.

## Decision Drivers

- Consistency with sibling projects that already subscribe to the `ai-team` plugin
- Single source of truth for AI workflows (subagents, hooks, commands) via the plugin instead of locally-committed copies
- Documented standards for source control, CI/CD, testing, observability, secrets, IaC, releases, AI workflows
- Make platform improvements automatic - when the workspace evolves, this project picks up the changes via the plugin

## Considered Options

- **Option A:** Adopt the platform fully (Phases 1-5 minimum)
- **Option B:** Adopt only the AI configuration (plugin subscription) and skip the other standards
- **Option C:** Defer indefinitely - keep the project untouched

## Decision Outcome

**Option A — phased adoption.** Apply Phases 1-4 immediately (documentation + plugin subscription + quality gates + CI workflows). Defer Phases 5-7 (observability, IaC retrofit, user feedback Lambda) as separate decisions.

### Phase status (at this ADR's acceptance)

| Phase | Status | Notes |
|---|---|---|
| 1 - Documentation | In this PR | `docs/` tree, mkdocs, ADRs, runbooks |
| 2 - AI configuration | In this PR | `.claude/settings.json` subscribes to `ai-team` plugin (workspace ADR-0015) |
| 3 - Quality gates | Follow-up PR | ESLint flat config, prettier, husky, lint-staged, commitlint, vitest with tiered coverage |
| 4 - CI workflows | Follow-up PR | claude-pr-review, security-scan, release-please, mkdocs deploy |
| 5 - Observability | Deferred | Sentry frontend + Lambda libs - separate decision |
| 6 - IaC retrofit | Deferred | AWS infra is doc-only today; multi-PR effort when prioritized |
| 7 - User feedback Lambda | Not applicable | Portal is admin-only; users do not submit feedback through it |

## Deviations from platform defaults

Sub-decisions bundled here per the ADR template's "Bundled sub-decisions" allowance. Each is a project-specific override that the platform's workflows are expected to tolerate.

### Frontend language: vanilla JS, not TypeScript

The platform's `typescript-app` template is Next.js + TypeScript. This project is Vite + vanilla JS + Tailwind, matching game-night-pwa and meal-planner. Use the JS-flavored ESLint config, no `tsconfig.json`.

### Deploy: CLI-only, not GitHub Actions

`.github/workflows/deploy.yml` runs on push to `main` but the Lambda update step is currently manual. Frontend deploy is also CLI today. Phase 4 will augment `deploy.yml` with a sentry-release step but will NOT replace the manual Lambda deploy until Phase 5 lands a proper observability story.

### Auth: shared Cognito user pool, not project-owned

Cognito user pool, hosted UI, and App Clients are shared with sibling apps under `just.jaetill.com`. The portal reads them as a fixed data source; it does NOT manage them.

### Email: Postmark, not AWS SES

Invite and nudge emails go through Postmark from `jason@jaetill.com`. Cognito's default Welcome-email path is unreliable and is the suspected cause of an earlier spam-routing bug. SES is not used by any sibling app.

### IaC: docs-only

AWS resources (API Gateway route, Lambda function, IAM role, Secrets Manager secret) are managed manually today. Phase 6 (IaC retrofit) is deferred. When prioritized, it will follow the multi-PR import pattern in the platform's procedure.

### Tests: none initially

The project has no tests today. Phase 3 will add vitest scaffolding with platform-standard tiered coverage thresholds. Existing code will be exempt from those thresholds via vitest's `coverage.include`/`exclude` until tests are written.

### Branch convention: main

Matches the platform default. No deviation.

## Consequences

### Positive

- Subagents (architect, code-reviewer, security-reviewer, etc.) become available immediately via the plugin
- Updates to the platform flow into this project with zero code changes
- Same engineering discipline applies here as on game-night-pwa, meal-planner, ai-teacher

### Negative

- Each Phase 3-4 PR adds ~10 dev dependencies and dozens of config files
- `--legacy-peer-deps` required for any `npm install` (Vite 8 + `@tailwindcss/vite` peer range mismatch)
- Phase 5 must happen before the deploy story is fully production-grade (no error tracking, no release tagging)

### Neutral

- The platform plugin source is `github.com/jaetill/agentic-dev-environment` (private). Anyone consuming this project's `.claude/settings.json` needs read access to the workspace repo for the plugin to resolve.

## Implementation notes

- **Plugin subscription:** `.claude/settings.json` with `extraKnownMarketplaces.agentic-dev-environment.source = {"source": "github", "repo": "jaetill/agentic-dev-environment"}` and `enabledPlugins["ai-team@agentic-dev-environment"] = true`.
- **Permissions:** the canonical deny block from the plugin README (plugin manifests cannot ship permissions per the Claude Code spec).
- **Workspace standards:** the 11 standards docs live at `github.com/jaetill/agentic-dev-environment/tree/main/docs/standards`. They are the source of truth for how this project should be operated.

## Links

- [Workspace ADR-0015 - platform as plugin](https://github.com/jaetill/agentic-dev-environment/blob/main/docs/adr/0015-platform-as-plugin.md) - the upstream decision that authorized plugin-based platform delivery
- [Workspace standards](https://github.com/jaetill/agentic-dev-environment/tree/main/docs/standards)
- Sibling project adoptions: game-night-pwa, meal-planner, ai-teacher (all adopted 2026-05-16)