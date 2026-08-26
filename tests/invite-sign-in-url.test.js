import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Regression guard for the "sign-in link 404s" bug.
//
// `lambda/invite.js` builds the nudge email's "Sign in" button from
// SIGN_IN_URL. It was defaulting to `https://just.jaetill.com/` — the Cognito
// custom domain. That host only serves /login, /oauth2/*, /logout and /error;
// its root returns 404, so every invitee who clicked the button hit a dead end.
//
// This asserts on source text rather than importing the module: invite.js
// constructs AWS SDK clients at module scope, and @aws-sdk/* is supplied by the
// Lambda runtime rather than lambda/package.json, so it does not resolve here.
// If those templates ever move into a dependency-free lib/ module, replace this
// with a real unit test of the builders.

// Resolved from the Vitest root (the project root) rather than import.meta.url:
// under the happy-dom environment import.meta.url is an http: URL from Vite's
// transform pipeline, not a file: URL, so fileURLToPath rejects it.
const SOURCE = readFileSync(resolve(process.cwd(), 'lambda/invite.js'), 'utf8');

describe('invite.js SIGN_IN_URL', () => {
  it('defaults to the portal, not the Cognito custom domain', () => {
    const match = SOURCE.match(
      /const SIGN_IN_URL\s*=\s*process\.env\.SIGN_IN_URL\s*\|\|\s*'([^']+)'/,
    );
    expect(match, 'SIGN_IN_URL declaration not found — did it get renamed?').not.toBeNull();

    const fallback = match[1];
    expect(fallback).toBe('https://jaetill.com/');
  });

  it('never links the bare Cognito auth domain from an email template', () => {
    // The auth domain is legitimate inside a full /oauth2/... or /login?... URL,
    // but a bare origin is always a 404.
    const bareAuthDomain =
      /https:\/\/just\.jaetill\.com\/?(?!login|oauth2|logout|error|signup|confirmUser|forgotPassword)['"`\s]/;
    expect(bareAuthDomain.test(SOURCE)).toBe(false);
  });
});
