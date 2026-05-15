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
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });

// When WebAuthn is in AllowedFirstAuthFactors, Cognito's auto-temp-password
// generation refuses with "User is required to have a password." Generate one
// explicitly that satisfies the pool password policy.
function generateTempPassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num   = '23456789';
  const sym   = '!@#$%^&*';
  const all   = lower + upper + num + sym;
  const pick  = (s) => s[crypto.randomInt(0, s.length)];

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
  'game-night':   'game-night-users',
  'carto':        'carto-users',
};

// ── Helpers ─────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age':       '300',
    'Content-Type':                 'application/json',
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
    return claim.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean);
  }
  return [];
}

// ── Handler ─────────────────────────────────────────────────────

exports.handler = async (event) => {
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
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { message: 'Invalid JSON body' }); }

  const email = (body.email || '').trim().toLowerCase();
  const apps  = Array.isArray(body.apps) ? body.apps : [];

  if (!email || !email.includes('@')) {
    return resp(400, { message: 'Valid email required' });
  }
  if (apps.length === 0) {
    return resp(400, { message: 'At least one app must be selected' });
  }

  const groupNames = apps.map(a => APP_TO_GROUP[a]);
  if (groupNames.some(g => !g)) {
    return resp(400, { message: `Unknown app id; valid: ${Object.keys(APP_TO_GROUP).join(', ')}` });
  }

  // Create user — idempotent. If the email alias is already taken, look up the
  // existing user and add groups to them instead.
  let isNew = true;
  let username = crypto.randomUUID();

  try {
    // Pool has AliasAttributes=["email"] — username can't be the email itself.
    // Use a UUID; the user signs in with their email (alias) at the Hosted UI.
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId:        POOL_ID,
      Username:          username,
      TemporaryPassword: generateTempPassword(),
      UserAttributes: [
        { Name: 'email',          Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }));
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
    const lookup = await cognito.send(new ListUsersCommand({
      UserPoolId: POOL_ID,
      Filter:     `email = "${email}"`,
      Limit:      1,
    }));
    if (!lookup.Users || lookup.Users.length === 0) {
      return resp(500, { message: `Could not find existing user for ${email}` });
    }
    username = lookup.Users[0].Username;
  }

  for (const grp of groupNames) {
    try {
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: POOL_ID,
        Username:   username,
        GroupName:  grp,
      }));
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
};

// ── GET /invite — list all users + their app groups ────────────────

async function handleListUsers() {
  // Page through ListUsers (default page size 60; pool currently <50 users so
  // one page is usually enough, but we paginate defensively for the future).
  const allUsers = [];
  let paginationToken;
  try {
    do {
      const page = await cognito.send(new ListUsersCommand({
        UserPoolId:       POOL_ID,
        Limit:            60,
        PaginationToken:  paginationToken,
      }));
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
      const attrs = Object.fromEntries((u.Attributes || []).map(a => [a.Name, a.Value]));
      let userGroups = [];
      try {
        const r = await cognito.send(new AdminListGroupsForUserCommand({
          UserPoolId: POOL_ID,
          Username:   u.Username,
        }));
        userGroups = (r.Groups || []).map(g => g.GroupName);
      } catch (err) {
        console.warn(`AdminListGroupsForUser ${u.Username} failed:`, err.message);
      }
      enriched[i] = {
        username:   u.Username,
        email:      attrs.email || '',
        name:       attrs.name  || '',
        status:     u.UserStatus || '',
        createdAt:  u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : null,
        enabled:    u.Enabled !== false,
        groups:     userGroups,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, allUsers.length) }, worker));

  // Sort by email for stable display
  enriched.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  return resp(200, { users: enriched });
}
