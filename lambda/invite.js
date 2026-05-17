/*
 * Route(s):    POST /invite — create user + assign app groups
 *              GET  /invite — list all users with their app groups (admin table)
 * Auth:        Cognito JWT (caller must be in `admins` group)
 * Env vars:    USER_POOL_ID, REGION, ALLOWED_ORIGIN
 * Cognito:     AdminCreateUser, AdminAddUserToGroup, AdminListGroupsForUser,
 *              ListUsers against the shared pool
 *
 * POST body:   { "email": "alice@example.com", "apps": ["meal-planner", "game-night"] }
 *              Idempotent. If the user already exists, just adds the requested
 *              groups. New users are created with email_verified=true and Cognito
 *              sends an invitation email with a temp password.
 *
 * GET response: { users: [{ email, status, createdAt, groups: [...] }, ...] }
 *               Returns ALL users in the pool (cross-app, not just app-specific).
 */

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');
const { Sentry } = require('./lib/sentry');
const https = require('https');

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const smClient = new SecretsManagerClient({ region: process.env.REGION });

// Lazily fetched + cached for the lifetime of the Lambda container.
// Same shared secret as game-night-pwa's nudge.js — one Postmark API key
// for all jaetill.com mail senders.
let _secrets;
async function getSecrets() {
  if (!_secrets) {
    const res = await smClient.send(
      new GetSecretValueCommand({ SecretId: 'shared/postmark-api-key' }),
    );
    _secrets = JSON.parse(res.SecretString);
  }
  return _secrets;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'jason@jaetill.com';
const SIGN_IN_URL = process.env.SIGN_IN_URL || 'https://just.jaetill.com/';

// In-memory per-user cooldown to absorb accidental double-clicks.
// Survives warm Lambda invocations; resets on cold start. Per ADR-0014's
// "accident-protection, not rate-limit" model — for true rate limiting,
// move to a persistent store.
const lastNudgedAt = new Map(); // email (lc) → epoch ms
const NUDGE_COOLDOWN_MS = 60_000;

// When WebAuthn is in AllowedFirstAuthFactors, Cognito's auto-temp-password
// generation refuses with "User is required to have a password." Generate one
// explicitly that satisfies the pool password policy.
function generateTempPassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num = '23456789';
  const sym = '!@#$%^&*';
  const all = lower + upper + num + sym;
  const pick = (s) => s[crypto.randomInt(0, s.length)];

  // Guarantee one of each character class, then fill to 16
  const chars = [pick(lower), pick(upper), pick(num), pick(sym)];
  for (let i = 4; i < 16; i++) chars.push(pick(all));
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
const POOL_ID = process.env.USER_POOL_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://jaetill.com';

const APP_TO_GROUP = {
  'meal-planner': 'meal-planner-users',
  'game-night': 'game-night-users',
  carto: 'carto-users',
};

// ── Helpers ─────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '300',
    'Content-Type': 'application/json',
  };
}

function resp(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

// API Gateway delivers cognito:groups as either a JSON array or a "[a b c]" string.
function parseGroups(claim) {
  if (!claim) return [];
  if (Array.isArray(claim)) return claim;
  if (typeof claim === 'string') {
    return claim
      .replace(/^\[|\]$/g, '')
      .split(/[\s,]+/)
      .filter(Boolean);
  }
  return [];
}

// ── Handler ─────────────────────────────────────────────────────

exports.handler = Sentry.wrapHandler(async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  const claims = event.requestContext?.authorizer?.claims || {};
  const groups = parseGroups(claims['cognito:groups']);
  if (!groups.includes('admins')) {
    return resp(403, { message: 'Forbidden: admins group required' });
  }

  if (event.httpMethod === 'GET') {
    return await handleListUsers();
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return resp(400, { message: 'Invalid JSON body' });
  }

  // Discriminate on action. Default is 'create' for backward compatibility
  // with the existing UI which sends { email, apps } and expects user creation.
  const action = body.action || 'create';
  if (action === 'nudge') return await handleNudgeOne(body);
  if (action === 'nudge-all-stuck') return await handleNudgeAllStuck();
  if (action !== 'create') {
    return resp(400, {
      message: `Unknown action '${action}'. Expected one of: create, nudge, nudge-all-stuck.`,
    });
  }

  const email = (body.email || '').trim().toLowerCase();
  const apps = Array.isArray(body.apps) ? body.apps : [];

  if (!email || !email.includes('@')) {
    return resp(400, { message: 'Valid email required' });
  }
  if (apps.length === 0) {
    return resp(400, { message: 'At least one app must be selected' });
  }

  const groupNames = apps.map((a) => APP_TO_GROUP[a]);
  if (groupNames.some((g) => !g)) {
    return resp(400, { message: `Unknown app id; valid: ${Object.keys(APP_TO_GROUP).join(', ')}` });
  }

  // Create user — idempotent. If the email alias is already taken, look up the
  // existing user and add groups to them instead.
  let isNew = true;
  let username = crypto.randomUUID();

  try {
    // Pool has AliasAttributes=["email"] — username can't be the email itself.
    // Use a UUID; the user signs in with their email (alias) at the Hosted UI.
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: username,
        TemporaryPassword: generateTempPassword(),
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );
  } catch (err) {
    if (err.name === 'UsernameExistsException' || err.name === 'AliasExistsException') {
      isNew = false;
    } else {
      console.error('AdminCreateUser failed:', err);
      return resp(500, { message: err.message || 'Could not create user' });
    }
  }

  // Existing user: resolve email alias → real username for AdminAddUserToGroup
  if (!isNew) {
    const lookup = await cognito.send(
      new ListUsersCommand({
        UserPoolId: POOL_ID,
        Filter: `email = "${email}"`,
        Limit: 1,
      }),
    );
    if (!lookup.Users || lookup.Users.length === 0) {
      return resp(500, { message: `Could not find existing user for ${email}` });
    }
    username = lookup.Users[0].Username;
  }

  for (const grp of groupNames) {
    try {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: POOL_ID,
          Username: username,
          GroupName: grp,
        }),
      );
    } catch (err) {
      console.error(`AdminAddUserToGroup ${username} → ${grp} failed:`, err);
      return resp(500, { message: `Could not add to group ${grp}: ${err.message}` });
    }
  }

  return resp(200, {
    email,
    isNew,
    groups: groupNames,
    message: isNew
      ? `Invitation email sent to ${email}.`
      : `${email} added to ${groupNames.join(', ')}.`,
  });
});

// ── GET /invite — list all users + their app groups ────────────────

async function handleListUsers() {
  // Page through ListUsers (default page size 60; pool currently <50 users so
  // one page is usually enough, but we paginate defensively for the future).
  const allUsers = [];
  let paginationToken;
  try {
    do {
      const page = await cognito.send(
        new ListUsersCommand({
          UserPoolId: POOL_ID,
          Limit: 60,
          PaginationToken: paginationToken,
        }),
      );
      allUsers.push(...(page.Users || []));
      paginationToken = page.PaginationToken;
    } while (paginationToken);
  } catch (err) {
    console.error('ListUsers failed:', err);
    return resp(500, { message: err.message || 'Could not list users' });
  }

  // For each user, fetch their group memberships in parallel. Cap concurrency
  // at 8 to avoid throttling AdminListGroupsForUser on large pools.
  const concurrency = 8;
  const enriched = new Array(allUsers.length);
  let cursor = 0;
  async function worker() {
    while (cursor < allUsers.length) {
      const i = cursor++;
      const u = allUsers[i];
      const attrs = Object.fromEntries((u.Attributes || []).map((a) => [a.Name, a.Value]));
      let userGroups = [];
      try {
        const r = await cognito.send(
          new AdminListGroupsForUserCommand({
            UserPoolId: POOL_ID,
            Username: u.Username,
          }),
        );
        userGroups = (r.Groups || []).map((g) => g.GroupName);
      } catch (err) {
        console.warn(`AdminListGroupsForUser ${u.Username} failed:`, err.message);
      }
      enriched[i] = {
        username: u.Username,
        email: attrs.email || '',
        name: attrs.name || '',
        status: u.UserStatus || '',
        createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : null,
        enabled: u.Enabled !== false,
        groups: userGroups,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, allUsers.length) }, worker));

  // Sort by email for stable display
  enriched.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  return resp(200, { users: enriched });
}

// ── POST { action: 'nudge', email } — re-nudge one stuck user ───────

async function handleNudgeOne(body) {
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return resp(400, { message: 'Valid email required' });
  }

  // Cooldown — absorb double-clicks.
  const last = lastNudgedAt.get(email);
  if (last && Date.now() - last < NUDGE_COOLDOWN_MS) {
    const waitMs = NUDGE_COOLDOWN_MS - (Date.now() - last);
    return resp(429, {
      message: `Cooldown active. Try again in ${Math.ceil(waitMs / 1000)}s.`,
      retryAfterMs: waitMs,
    });
  }

  // Look up the user and verify state.
  const lookup = await cognito.send(
    new ListUsersCommand({
      UserPoolId: POOL_ID,
      Filter: `email = "${email}"`,
      Limit: 1,
    }),
  );
  if (!lookup.Users || lookup.Users.length === 0) {
    return resp(404, { message: `No user with email ${email}` });
  }
  const user = lookup.Users[0];
  if (user.UserStatus !== 'FORCE_CHANGE_PASSWORD') {
    return resp(409, {
      message: `User ${email} is in status '${user.UserStatus}', not FORCE_CHANGE_PASSWORD. Nothing to nudge.`,
    });
  }

  // Generate a fresh temp password and set it (non-permanent).
  const tempPassword = generateTempPassword();
  try {
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: POOL_ID,
        Username: user.Username,
        Password: tempPassword,
        Permanent: false,
      }),
    );
  } catch (err) {
    console.error('AdminSetUserPassword failed:', err);
    return resp(500, { message: err.message || 'Could not reset temp password' });
  }

  // Send via Postmark from jaetill.com (avoids Cognito's default sender,
  // which is the suspected source of the original spam-folder bug).
  try {
    const { POSTMARK_API_KEY } = await getSecrets();
    await postmark(POSTMARK_API_KEY, {
      To: email,
      From: FROM_EMAIL,
      Subject: `Reminder: complete your jaetill.com sign-in`,
      TextBody: buildNudgeText({ email, tempPassword }),
      HtmlBody: buildNudgeHtml({ email, tempPassword }),
      MessageStream: 'outbound',
    });
  } catch (err) {
    console.error('postmark.nudge_failed:', err);
    return resp(500, { message: 'Could not send nudge email', error: err.message });
  }

  lastNudgedAt.set(email, Date.now());
  return resp(200, { sent: 1, email, status: 'nudged' });
}

// ── POST { action: 'nudge-all-stuck' } — bulk nudge ─────────────────

async function handleNudgeAllStuck() {
  // Page through ListUsers.
  const allUsers = [];
  let paginationToken;
  try {
    do {
      const page = await cognito.send(
        new ListUsersCommand({
          UserPoolId: POOL_ID,
          Limit: 60,
          PaginationToken: paginationToken,
        }),
      );
      allUsers.push(...(page.Users || []));
      paginationToken = page.PaginationToken;
    } while (paginationToken);
  } catch (err) {
    console.error('ListUsers failed:', err);
    return resp(500, { message: err.message || 'Could not list users' });
  }

  // Filter to stuck users.
  const stuck = allUsers.filter((u) => u.UserStatus === 'FORCE_CHANGE_PASSWORD');
  if (stuck.length === 0) {
    return resp(200, { sent: 0, skipped: 0, total: 0, message: 'No stuck users to nudge.' });
  }

  // Fetch the Postmark key once for the batch.
  let POSTMARK_API_KEY;
  try {
    ({ POSTMARK_API_KEY } = await getSecrets());
  } catch (err) {
    console.error('getSecrets failed:', err);
    return resp(500, { message: 'Could not load Postmark key', error: err.message });
  }

  const results = { sent: 0, skipped: 0, errors: [] };
  for (const u of stuck) {
    const attrs = Object.fromEntries((u.Attributes || []).map((a) => [a.Name, a.Value]));
    const email = (attrs.email || '').toLowerCase();
    if (!email) {
      results.errors.push({ username: u.Username, reason: 'no email attribute' });
      continue;
    }

    // Per-user cooldown.
    const last = lastNudgedAt.get(email);
    if (last && Date.now() - last < NUDGE_COOLDOWN_MS) {
      results.skipped++;
      continue;
    }

    // Generate + set + send. Continue past errors so one failure doesn't
    // abort the batch.
    try {
      const tempPassword = generateTempPassword();
      await cognito.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: POOL_ID,
          Username: u.Username,
          Password: tempPassword,
          Permanent: false,
        }),
      );
      await postmark(POSTMARK_API_KEY, {
        To: email,
        From: FROM_EMAIL,
        Subject: `Reminder: complete your jaetill.com sign-in`,
        TextBody: buildNudgeText({ email, tempPassword }),
        HtmlBody: buildNudgeHtml({ email, tempPassword }),
        MessageStream: 'outbound',
      });
      lastNudgedAt.set(email, Date.now());
      results.sent++;
    } catch (err) {
      console.error(`Nudge failed for ${email}:`, err);
      results.errors.push({ email, reason: err.message });
    }
  }

  return resp(200, { ...results, total: stuck.length });
}

// ── Email templates ─────────────────────────────────────────────────

function buildNudgeText({ email, tempPassword }) {
  return [
    `Hi,`,
    ``,
    `We sent you an invitation to sign in at jaetill.com but you haven't`,
    `completed the sign-in yet. Here are fresh credentials:`,
    ``,
    `  Email:          ${email}`,
    `  Temp password:  ${tempPassword}`,
    `  Sign-in URL:    ${SIGN_IN_URL}`,
    ``,
    `When you sign in, you'll be prompted to set a permanent password.`,
    ``,
    `If you weren't expecting this email, you can safely ignore it.`,
  ].join('\n');
}

function buildNudgeHtml({ email, tempPassword }) {
  const e = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi,</p>
  <p>We sent you an invitation to sign in at jaetill.com but you haven't completed
     the sign-in yet. Here are fresh credentials:</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
    <table style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;border-collapse:collapse;">
      <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Email</td><td style="padding:2px 0;color:#1e293b;"><strong>${e(email)}</strong></td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Temp password</td><td style="padding:2px 0;color:#1e293b;"><strong>${e(tempPassword)}</strong></td></tr>
    </table>
  </div>
  <p><a href="${e(SIGN_IN_URL)}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Sign in</a></p>
  <p>When you sign in, you'll be prompted to set a permanent password.</p>
  <p style="color:#64748b;font-size:13px;margin-top:24px;">If you weren't expecting this email, you can safely ignore it.</p>
</body></html>`;
}

// ── Postmark client ─────────────────────────────────────────────────

function postmark(apiKey, msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(msg);
    const req = https.request(
      {
        hostname: 'api.postmarkapp.com',
        path: '/email',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': apiKey,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
          else reject(new Error(`Postmark ${res.statusCode}: ${data}`));
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
