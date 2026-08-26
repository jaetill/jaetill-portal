/*
 * Route(s):    POST /invite — create user + assign app groups
 *              GET  /invite — list all users with their app groups (admin table)
 * Auth:        Cognito JWT (caller must be in `admins` group)
 * Env vars:    USER_POOL_ID, REGION, ALLOWED_ORIGIN, FROM_EMAIL, SIGN_IN_URL
 * Cognito:     AdminCreateUser, AdminAddUserToGroup, AdminListGroupsForUser,
 *              AdminSetUserPassword, AdminDeleteUser, ListUsers against the
 *              shared pool
 *
 * Actions:     POST body.action — create (default), nudge, nudge-all-stuck,
 *              delete
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
  AdminDeleteUserCommand,
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');
const { Sentry } = require('./lib/sentry');
const { buildAccessEmail } = require('./lib/emails');
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
// Must be the PORTAL, not the Cognito custom domain. `just.jaetill.com` serves
// only /login, /oauth2/*, /logout and /error — its root returns 404, which is
// exactly what invitees saw when they clicked "Sign in" in this email. The
// portal root runs the PKCE redirect itself (generating verifier + state and
// supplying the right client_id), which a static email link cannot do.
const SIGN_IN_URL = process.env.SIGN_IN_URL || 'https://jaetill.com/';

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

// Human-readable names for the invite email, so the invitee is told what they
// were actually granted rather than a bare list of slugs.
const APP_LABEL = {
  'meal-planner': 'Meal Planner',
  'game-night': 'Game Night',
  carto: 'Carto',
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
  if (action === 'delete') return await handleDeleteUser(body, claims);
  if (action !== 'create') {
    return resp(400, {
      message: `Unknown action '${action}'. Expected one of: create, nudge, nudge-all-stuck, delete.`,
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
  const tempPassword = generateTempPassword();

  try {
    // Pool has AliasAttributes=["email"] — username can't be the email itself.
    // Use a UUID; the user signs in with their email (alias) at the Hosted UI.
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: username,
        TemporaryPassword: tempPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        // Cognito's default invitation email contains no link — it hands the
        // invitee a username and password with nowhere to use them, which is
        // why invited users sat in FORCE_CHANGE_PASSWORD indefinitely. Suppress
        // it and send our own from jaetill.com below, matching the nudge email.
        MessageAction: 'SUPPRESS',
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

  // Only a brand-new account gets an email — the temp password above is the
  // one Cognito actually stored, and it is meaningless for a user who already
  // has a password. To re-send to someone still stuck, use action 'nudge',
  // which mints a fresh one.
  let emailSent = false;
  if (isNew) {
    try {
      const { POSTMARK_API_KEY } = await getSecrets();
      const msg = buildAccessEmail({
        variant: 'invite',
        email,
        tempPassword,
        signInUrl: SIGN_IN_URL,
        appNames: apps.map((a) => APP_LABEL[a]).filter(Boolean),
      });
      await postmark(POSTMARK_API_KEY, {
        To: email,
        From: FROM_EMAIL,
        Subject: msg.subject,
        TextBody: msg.text,
        HtmlBody: msg.html,
        MessageStream: 'outbound',
      });
      emailSent = true;
    } catch (err) {
      // The account exists and the groups are attached, so this is not a
      // failed invite — just an unsent one. Reporting 500 would invite a retry
      // that no-ops on create and still sends nothing, so surface the partial
      // success and point at Nudge, which does mint a fresh password and send.
      console.error('postmark.invite_failed:', err);
      Sentry.captureException(err);
    }
  }

  return resp(200, {
    email,
    isNew,
    emailSent,
    groups: groupNames,
    message: !isNew
      ? `${email} added to ${groupNames.join(', ')}.`
      : emailSent
        ? `Invitation sent to ${email}.`
        : `${email} was created, but the invitation email failed to send. Use Nudge in the table below to try again.`,
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
    const msg = buildAccessEmail({
      variant: 'reminder',
      email,
      tempPassword,
      signInUrl: SIGN_IN_URL,
    });
    await postmark(POSTMARK_API_KEY, {
      To: email,
      From: FROM_EMAIL,
      Subject: msg.subject,
      TextBody: msg.text,
      HtmlBody: msg.html,
      MessageStream: 'outbound',
    });
  } catch (err) {
    console.error('postmark.nudge_failed:', err);
    return resp(500, { message: 'Could not send nudge email', error: err.message });
  }

  lastNudgedAt.set(email, Date.now());
  return resp(200, { sent: 1, email, status: 'nudged' });
}

// ── POST { action: 'delete', email } — remove a user ────────────────
//
// Deletes any user regardless of status, by explicit choice: the pool is
// invite-only with a single admin, and a mistyped address needs to be
// removable whether or not the invitee got as far as signing in.
//
// The one refusal is self-deletion. `admins` membership is what unlocks this
// endpoint, so deleting your own account permanently locks you out of the
// portal with no in-app way back.
//
// Deleting a CONFIRMED user is destructive beyond Cognito: sibling apps key S3
// objects by Cognito username (`profiles/{userId}.json`,
// `collections/{userId}.json`, and `hostUserId` on game nights), and none of
// that is cleaned up or reassigned here. The caller is warned in the UI.
async function handleDeleteUser(body, claims) {
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return resp(400, { message: 'Valid email required' });
  }

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

  // Self-delete guard. Match on username first — it is the pool's real
  // identity — and fall back to the email claim if the username claim is
  // absent from the token.
  const callerUsername = claims['cognito:username'];
  const callerEmail = (claims.email || '').trim().toLowerCase();
  if (
    (callerUsername && callerUsername === user.Username) ||
    (callerEmail && callerEmail === email)
  ) {
    return resp(409, {
      message:
        'You cannot delete your own account — admin access to this portal would be lost with no way back in.',
    });
  }

  const previousStatus = user.UserStatus || 'UNKNOWN';
  try {
    await cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: POOL_ID,
        Username: user.Username,
      }),
    );
  } catch (err) {
    console.error(`AdminDeleteUser ${user.Username} failed:`, err);
    return resp(500, { message: err.message || 'Could not delete user' });
  }

  // Drop any pending nudge cooldown so a re-invite of the same address is not
  // silently throttled by the deleted user's entry.
  lastNudgedAt.delete(email);

  return resp(200, { deleted: email, previousStatus });
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
      const msg = buildAccessEmail({
        variant: 'reminder',
        email,
        tempPassword,
        signInUrl: SIGN_IN_URL,
      });
      await postmark(POSTMARK_API_KEY, {
        To: email,
        From: FROM_EMAIL,
        Subject: msg.subject,
        TextBody: msg.text,
        HtmlBody: msg.html,
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
