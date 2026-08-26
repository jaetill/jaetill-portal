import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Regression guard for the "sign-in link 404s" bug.
//
// SIGN_IN_URL was defaulting to `https://just.jaetill.com/` — the Cognito
// custom domain. That host only serves /login, /oauth2/*, /logout and /error;
// its root returns 404, so every invitee who clicked "Sign in" hit a dead end.
//
// The email bodies themselves are covered properly in emails.test.js, which
// imports lambda/lib/emails.js. This file guards only the value invite.js feeds
// them, which cannot be imported: invite.js constructs AWS SDK clients at
// module scope and @aws-sdk/* is supplied by the Lambda runtime rather than
// lambda/package.json, so it does not resolve here. Hence a source assertion.
//
// Resolved from the Vitest root rather than import.meta.url: under happy-dom
// that is an http: URL from Vite's transform pipeline, not a file: URL.
const SOURCE = readFileSync(resolve(process.cwd(), 'lambda/invite.js'), 'utf8');

describe('invite.js SIGN_IN_URL', () => {
  it('defaults to the portal, not the Cognito custom domain', () => {
    const match = SOURCE.match(
      /const SIGN_IN_URL\s*=\s*process\.env\.SIGN_IN_URL\s*\|\|\s*'([^']+)'/,
    );
    expect(match, 'SIGN_IN_URL declaration not found — did it get renamed?').not.toBeNull();
    expect(match[1]).toBe('https://jaetill.com/');
  });
});

describe('invite.js create flow', () => {
  it("suppresses Cognito's own invitation email", () => {
    // Cognito's default template has no link in it. If this ever comes back,
    // invitees get two emails and the useless one arrives first.
    expect(SOURCE).toMatch(/MessageAction:\s*'SUPPRESS'/);
  });

  it('sends its own invite instead', () => {
    expect(SOURCE).toMatch(/buildAccessEmail\(\{\s*\n?\s*variant:\s*'invite'/);
  });
});
