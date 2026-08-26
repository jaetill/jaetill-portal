# ADR-0002: Admin user deletion from the portal

- **Status:** Accepted
- **Date:** 2026-08-26
- **Deciders:** Jason Tilley
- **Tags:** security, admin, cognito, iam

> **Format:** This ADR follows [MADR 4.x](https://adr.github.io/madr/) with three documented extensions: (1) **Neutral consequences** as a third bucket alongside Positive/Negative; (2) **Implementation notes** as a separate section before Links; (3) **Bundled sub-decisions** when multiple related decisions are tightly coupled (each sub-decision gets its own Considered Options and Pros and Cons sections).

## Context and Problem Statement

The portal's admin invite flow can create users and nudge stuck ones, but there is no way to remove a user once created. A mistyped email address leaves a zombie `FORCE_CHANGE_PASSWORD` entry that cannot be cleaned up without CLI access to Cognito. Active users who should lose access (e.g. after leaving the family group) must also be removed from the shared pool, since Cognito group removal alone still leaves a valid sign-in path.

How should the portal expose user deletion to admins, and what safeguards are appropriate given that deletion is irreversible and affects data in sibling apps?

## Decision Drivers

- Admin must be able to fix mistyped invites without AWS CLI access
- Deletion is permanent in Cognito — there is no soft-delete or recycle bin
- Sibling apps (meal-planner, game-night) key S3 objects by Cognito username; deleting the user orphans that data with no automated cleanup
- The portal is invite-only with a single admin today; losing admin access is unrecoverable without CLI intervention
- The Lambda's IAM role must be expanded to include `AdminDeleteUser`, broadening its blast radius

## Considered Options

- Sub-decision 1: Deletion model (hard-delete vs. soft-delete vs. group-removal-only)
- Sub-decision 2: Self-deletion guard
- Sub-decision 3: Confirmation UX for destructive action

## Decision Outcome

We chose the bundle:

- Sub-decision 1 → Hard-delete via `AdminDeleteUser`
- Sub-decision 2 → Server-side self-deletion refusal (username + email claim match)
- Sub-decision 3 → Client-side `confirm()` with status-aware warning text

The bundle is internally consistent because hard-delete is the only Cognito-native removal mechanism, the self-deletion guard is necessary precisely because hard-delete is irreversible, and the confirmation UX must differentiate pending vs. active users because only the latter causes data orphaning.

## Consequences

### Positive

- Admins can fix mistyped invites entirely within the portal UI
- Revoking access is immediate and total — no residual sign-in path
- Self-deletion guard prevents the single admin from locking themselves out

### Negative

- IAM role gains `cognito-idp:AdminDeleteUser`, increasing the Lambda's blast radius on the shared pool
- Sibling-app data keyed by username is orphaned with no cleanup — game night collections, profiles, hosted events become unreachable but still consume storage
- A compromised admin token can now delete any user (previously it could only create/nudge)

### Neutral

- The in-memory nudge cooldown map is cleared on deletion, so re-inviting a previously-deleted address is not silently throttled — this is correct behavior but worth noting as a coupling between the nudge and delete paths

## Pros and Cons of the Options

### Sub-decision 1: Deletion model

| Option                           | Pros                                                                         | Cons                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hard-delete** (chosen)         | Only Cognito-native option; no custom state to maintain; immediate and total | Irreversible; orphans sibling-app data; broader IAM scope                                                                                                    |
| **Soft-delete** (disable + flag) | Reversible; data stays intact                                                | Cognito has no native disable-user API — would require a custom attribute or DynamoDB side-table; user can still hold a valid refresh token until it expires |
| **Group-removal only**           | No new IAM permission; non-destructive                                       | User retains a valid Cognito account and can still sign in (just sees no tiles); does not fix mistyped-email problem at all                                  |

### Sub-decision 2: Self-deletion guard

| Option                           | Pros                                                                                         | Cons                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-side refusal** (chosen) | Enforced regardless of client; matches on both username claim and email claim for robustness | Relies on JWT claims being present. `cognito:username` is always present in an ID token, and the API Gateway Cognito authorizer forwards ID-token claims, so the primary match is dependable; the `email` fallback covers only the case where it somehow is not. Note this is **not** related to the `aws.cognito.signin.user.admin` scope, which governs access-token user-pool operations rather than ID-token claim contents |
| **Client-side only**             | Simpler Lambda code                                                                          | Trivially bypassable with a direct API call; single point of failure                                                                                                                                                                                                                                                                                                                                                            |
| **No guard**                     | Simplest                                                                                     | Admin deletes themselves, loses all portal access, no recovery without CLI                                                                                                                                                                                                                                                                                                                                                      |

### Sub-decision 3: Confirmation UX

| Option                                                                      | Pros                                                                                                                   | Cons                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Status-aware `confirm()`** (chosen)                                       | Zero additional dependencies; warning text explains data impact for active users vs. trivial cleanup for pending users | `confirm()` is modal and browser-native — not styled; cannot include rich formatting |
| **Custom modal with typed confirmation** (e.g. "type the email to confirm") | Harder to accidentally confirm; can include richer warning                                                             | Over-engineered for a single-admin tool with ~10 users; adds UI complexity           |
| **No confirmation**                                                         | Fastest flow                                                                                                           | One mis-click deletes a user irreversibly                                            |

## Implementation notes

- **IAM policy:** `lambda/iam/cognito-admin.json` now includes `cognito-idp:AdminDeleteUser` scoped to the shared pool ARN. The file is a committed copy, not the source of truth — the live policy is applied manually with `aws iam put-role-policy` (IaC is deferred per ADR-0001 Phase 6). It was applied on 2026-08-26, ahead of this ADR merging, so live and committed agree today; nothing enforces that they keep agreeing until Phase 6 lands.
- **Lambda handler:** `lambda/invite.js` dispatches `POST { action: 'delete', email }` to `handleDeleteUser()`. The handler looks up the user by email filter, checks self-deletion, then calls `AdminDeleteUser`.
- **Frontend:** `src/js/main.js` renders a red "Delete" button on every row in the admin user table. The `confirm()` prompt varies by user status.
- **Nudge cooldown cleanup:** `lastNudgedAt.delete(email)` is called after successful deletion so that a re-invite to the same address is not throttled.

## Links

- [Cognito AdminDeleteUser API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminDeleteUser.html)
- ADR-0001 — platform adoption (documents IaC-deferred status and shared pool architecture)
