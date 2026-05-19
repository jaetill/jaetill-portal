import './feedback.js';
import { isAuthenticated, startLogin, logout, parseIdToken, getIdToken, getAccessToken } from './auth.js';
import { registerPasskey, listPasskeys, deletePasskey } from './passkey.js';
import { appsForUser } from './apps.js';
import { API_BASE } from './config.js';

const root = document.getElementById('app');

const KNOWN_APPS = [
  { id: 'meal-planner', name: 'Meal Planner' },
  { id: 'game-night',   name: 'Game Night' },
  { id: 'carto',        name: 'Carto' },
];

function init() {
  if (!isAuthenticated()) {
    renderSignIn();
    return;
  }
  renderLauncher(parseIdToken());
}

// ── Views ───────────────────────────────────────────────────────

function renderSignIn() {
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div class="text-5xl mb-3">🏠</div>
        <h1 class="text-3xl font-bold text-gray-900">jaetill.com</h1>
        <p class="text-gray-500 mt-2">Sign in to access your apps.</p>
        <button id="signin-btn"
                class="mt-6 w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
          Sign in
        </button>
      </div>
    </div>
  `;
  document.getElementById('signin-btn').addEventListener('click', () => startLogin());
}

function displayName(claims) {
  if (!claims) return 'there';
  if (claims.name) return claims.name;
  const u = claims['cognito:username'] || '';
  // UUID-format usernames (from admin-created invites) are ugly — fall back to email.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u)) {
    return claims.email || u;
  }
  return u || claims.email || 'there';
}

function renderLauncher(claims) {
  const apps     = appsForUser(claims);
  const username = displayName(claims);

  root.innerHTML = `
    <div class="min-h-screen p-6 max-w-5xl mx-auto">
      <header class="flex items-center justify-between mb-10">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Hey, ${escape(username)}</h1>
          <p class="text-gray-500 text-sm mt-1">Pick an app to launch.</p>
        </div>
        <button id="signout-btn" class="text-sm text-gray-600 hover:text-gray-900">Sign out</button>
      </header>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${apps.map(renderTile).join('')}
      </div>

      ${apps.length === 0 ? `
        <p class="text-center text-gray-500 mt-12">
          You haven't been invited to any apps yet. Ask the admin to grant you access.
        </p>
      ` : ''}

      <section class="mt-12 bg-white rounded-xl p-6 shadow-sm">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 class="font-semibold text-gray-900">Passkeys</h2>
            <p class="text-sm text-gray-500 mt-0.5" id="passkey-status">Loading…</p>
          </div>
          <button id="register-passkey-btn"
                  class="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            Register passkey
          </button>
        </div>
        <ul id="passkey-list" class="mt-4 space-y-2"></ul>
      </section>

      ${isAdmin(claims) ? renderAdminSection() : ''}
    </div>
  `;

  document.getElementById('signout-btn').addEventListener('click', () => logout());
  document.getElementById('register-passkey-btn').addEventListener('click', handleRegisterPasskey);
  loadPasskeys();

  if (isAdmin(claims)) {
    document.getElementById('invite-form').addEventListener('submit', handleInviteSubmit);
    loadAdminUsers();
  }
}

function renderTile(app) {
  return `
    <a href="${escape(app.url)}"
       class="block bg-gradient-to-br ${app.accent} rounded-xl p-6 shadow hover:shadow-lg transition-shadow">
      <div class="text-4xl mb-3">${app.icon}</div>
      <div class="text-lg font-semibold text-gray-900">${escape(app.name)}</div>
      <div class="text-sm text-gray-700 mt-1">${escape(app.description)}</div>
    </a>
  `;
}

// ── Admin invite ────────────────────────────────────────────────

function isAdmin(claims) {
  const groups = claims?.['cognito:groups'];
  return Array.isArray(groups) && groups.includes('admins');
}

function renderAdminSection() {
  const checkboxes = KNOWN_APPS.map(a => `
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="apps" value="${escape(a.id)}" class="rounded" />
      ${escape(a.name)}
    </label>
  `).join('');

  return `
    <section class="mt-8 bg-white rounded-xl p-6 shadow-sm">
      <h2 class="font-semibold text-gray-900">Invite a user</h2>
      <p class="text-sm text-gray-500 mt-0.5">Cognito will send them an invitation email with a temp password. They land on this portal and see the apps you grant.</p>
      <form id="invite-form" class="mt-4 space-y-3" novalidate>
        <input type="email" id="invite-email" placeholder="alice@example.com" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        <fieldset>
          <legend class="text-sm font-medium text-gray-700 mb-2">Grant access to:</legend>
          <div class="space-y-1">${checkboxes}</div>
        </fieldset>
        <div class="flex items-center gap-3 pt-2">
          <button type="submit" id="invite-btn"
                  class="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            Send invite
          </button>
          <p class="text-sm" id="invite-status"></p>
        </div>
      </form>
    </section>

    <section class="mt-8 bg-white rounded-xl p-6 shadow-sm">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 class="font-semibold text-gray-900">Users on jaetill.com</h2>
          <p class="text-sm text-gray-500 mt-0.5" id="admin-users-status">Loading…</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="nudge-all-btn"
                  class="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled>
            Nudge all stuck users
          </button>
          <button id="refresh-users-btn" class="text-sm text-gray-600 hover:text-gray-900">Refresh</button>
        </div>
      </div>
      <p class="text-sm" id="nudge-bulk-status"></p>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm" id="admin-users-table">
          <thead class="text-xs uppercase tracking-wide text-gray-500 border-b">
            <tr>
              <th class="text-left py-2 pr-4">Email</th>
              <th class="text-left py-2 pr-4">Status</th>
              <th class="text-left py-2 pr-4">Joined</th>
              <th class="text-left py-2 pr-4">Apps</th>
              <th class="text-left py-2">Actions</th>
            </tr>
          </thead>
          <tbody id="admin-users-tbody"></tbody>
        </table>
      </div>
    </section>
  `;
}

// ── Admin user table ────────────────────────────────────────────

const STATUS_PILL = {
  CONFIRMED:             { label: 'Active',          cls: 'bg-green-100 text-green-700' },
  FORCE_CHANGE_PASSWORD: { label: 'Pending sign-in', cls: 'bg-amber-100 text-amber-700' },
  RESET_REQUIRED:        { label: 'Reset required',  cls: 'bg-amber-100 text-amber-700' },
  EXTERNAL_PROVIDER:     { label: 'Federated',       cls: 'bg-blue-100 text-blue-700'   },
};

const APP_LABEL_BY_GROUP = {
  'admins':              { label: 'Admin',        cls: 'bg-gray-900 text-white' },
  'meal-planner-users':  { label: 'Meal Planner', cls: 'bg-emerald-100 text-emerald-800' },
  'game-night-users':    { label: 'Game Night',   cls: 'bg-amber-100 text-amber-800' },
  'carto-users':         { label: 'Carto',        cls: 'bg-slate-200 text-slate-800' },
};

async function loadAdminUsers() {
  const status = document.getElementById('admin-users-status');
  const tbody  = document.getElementById('admin-users-tbody');
  if (!status || !tbody) return;

  status.textContent = 'Loading…';
  status.className   = 'text-sm text-gray-500 mt-0.5';

  try {
    const res = await fetch(`${API_BASE}/invite`, {
      method:  'GET',
      headers: { 'Authorization': `Bearer ${getIdToken()}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

    const users = data.users || [];
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-400">No users yet.</td></tr>`;
      status.textContent = '0 users';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const pill = STATUS_PILL[u.status] || { label: u.status || '—', cls: 'bg-gray-100 text-gray-700' };
      const apps = (u.groups || [])
        .map(g => APP_LABEL_BY_GROUP[g] || { label: g, cls: 'bg-gray-100 text-gray-700' })
        .map(a => `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${a.cls} mr-1">${escape(a.label)}</span>`)
        .join('');
      const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—';
      const action = u.status === 'FORCE_CHANGE_PASSWORD'
        ? `<button class="nudge-btn text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 px-2 py-1 rounded" data-email="${escape(u.email || '')}">Nudge</button>`
        : '<span class="text-gray-300 text-xs">—</span>';
      return `
        <tr class="border-b last:border-0">
          <td class="py-2 pr-4 font-medium text-gray-900">${escape(u.email || '(no email)')}</td>
          <td class="py-2 pr-4"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${pill.cls}">${escape(pill.label)}</span></td>
          <td class="py-2 pr-4 text-gray-600">${escape(joined)}</td>
          <td class="py-2 pr-4">${apps || '<span class="text-gray-400 text-xs">none</span>'}</td>
          <td class="py-2">${action}</td>
        </tr>
      `;
    }).join('');

    // Wire per-row nudge buttons.
    tbody.querySelectorAll('.nudge-btn').forEach(btn => {
      btn.addEventListener('click', () => handleNudgeOne(btn));
    });

    // Wire the bulk button. Enable only when there's something to nudge.
    const stuckCount = users.filter(u => u.status === 'FORCE_CHANGE_PASSWORD').length;
    const bulkBtn = document.getElementById('nudge-all-btn');
    if (bulkBtn) {
      bulkBtn.disabled = stuckCount === 0;
      bulkBtn.textContent = stuckCount > 0
        ? `Nudge all stuck users (${stuckCount})`
        : 'Nudge all stuck users';
      bulkBtn.onclick = () => handleNudgeAllStuck(stuckCount);
    }

    status.textContent = `${users.length} user${users.length === 1 ? '' : 's'} (${stuckCount} stuck)`;

    const refreshBtn = document.getElementById('refresh-users-btn');
    if (refreshBtn) refreshBtn.onclick = loadAdminUsers;
  } catch (err) {
    status.textContent = `Couldn't load users: ${err.message}`;
    status.className   = 'text-sm text-red-600 mt-0.5';
    tbody.innerHTML    = '';
  }
}

async function handleInviteSubmit(e) {
  e.preventDefault();
  const status = document.getElementById('invite-status');
  const btn    = document.getElementById('invite-btn');
  const email  = document.getElementById('invite-email').value.trim();
  const apps   = Array.from(document.querySelectorAll('input[name="apps"]:checked')).map(el => el.value);

  status.textContent = '';
  status.className = 'text-sm';

  if (!email || !email.includes('@')) {
    status.textContent = 'Valid email required.';
    status.className = 'text-sm text-red-600';
    return;
  }
  if (apps.length === 0) {
    status.textContent = 'Pick at least one app.';
    status.className = 'text-sm text-red-600';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch(`${API_BASE}/invite`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getIdToken()}`,
      },
      body: JSON.stringify({ email, apps }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    status.textContent = data.message;
    status.className = 'text-sm text-green-600';
    document.getElementById('invite-form').reset();
  } catch (err) {
    status.textContent = `Failed: ${err.message}`;
    status.className = 'text-sm text-red-600';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Send invite';
  }
}

// ── Admin nudge actions ────────────────────────────────────────

async function handleNudgeOne(btn) {
  const email = btn.dataset.email;
  if (!email) return;
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch(`${API_BASE}/invite`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getIdToken()}`,
      },
      body: JSON.stringify({ action: 'nudge', email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    btn.textContent = 'Nudged ✓';
    btn.classList.remove('bg-amber-100', 'text-amber-800', 'hover:bg-amber-200');
    btn.classList.add('bg-green-100', 'text-green-800');
    // Disable for the cooldown window; the user can refresh to re-evaluate.
    setTimeout(() => {
      btn.textContent = originalLabel;
      btn.classList.remove('bg-green-100', 'text-green-800');
      btn.classList.add('bg-amber-100', 'text-amber-800', 'hover:bg-amber-200');
      btn.disabled = false;
    }, 60_000);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalLabel;
    alert(`Couldn't nudge ${email}: ${err.message}`);
  }
}

async function handleNudgeAllStuck(stuckCount) {
  if (stuckCount === 0) return;
  if (!confirm(`This will email ${stuckCount} stuck user${stuckCount === 1 ? '' : 's'}. Continue?`)) return;

  const bulkBtn = document.getElementById('nudge-all-btn');
  const bulkStatus = document.getElementById('nudge-bulk-status');
  bulkBtn.disabled = true;
  bulkBtn.textContent = 'Sending…';
  if (bulkStatus) {
    bulkStatus.textContent = '';
    bulkStatus.className = 'text-sm';
  }

  try {
    const res = await fetch(`${API_BASE}/invite`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getIdToken()}`,
      },
      body: JSON.stringify({ action: 'nudge-all-stuck' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    if (bulkStatus) {
      const errs = (data.errors || []).length;
      bulkStatus.textContent = `Nudged ${data.sent}, skipped ${data.skipped} (cooldown), errors ${errs}.`;
      bulkStatus.className = `text-sm ${errs > 0 ? 'text-amber-700' : 'text-green-600'}`;
    }
    // Refresh the table to reflect any state changes.
    await loadAdminUsers();
  } catch (err) {
    if (bulkStatus) {
      bulkStatus.textContent = `Bulk nudge failed: ${err.message}`;
      bulkStatus.className = 'text-sm text-red-600';
    }
    bulkBtn.disabled = false;
    bulkBtn.textContent = 'Nudge all stuck users';
  }
}

// ── Passkeys ────────────────────────────────────────────────────

async function loadPasskeys() {
  const token = getAccessToken();
  if (!token) return;

  const status = document.getElementById('passkey-status');
  const list   = document.getElementById('passkey-list');

  try {
    const passkeys = await listPasskeys(token);
    if (passkeys.length === 0) {
      status.textContent = 'No passkeys registered yet. Click to add one.';
      list.innerHTML = '';
      return;
    }
    status.textContent = `${passkeys.length} passkey${passkeys.length === 1 ? '' : 's'} registered.`;
    list.innerHTML = passkeys.map(p => `
      <li class="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
        <span>
          <span class="font-medium">${escape(p.FriendlyCredentialName || 'Unnamed passkey')}</span>
          <span class="text-gray-500 ml-2">added ${formatDate(p.CreatedAt)}</span>
        </span>
        <button data-id="${escape(p.CredentialId)}" class="passkey-delete text-red-600 hover:underline">
          Remove
        </button>
      </li>
    `).join('');
    list.querySelectorAll('.passkey-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDeletePasskey(btn.dataset.id));
    });
  } catch (err) {
    status.textContent = `Couldn't load passkeys: ${err.message}`;
  }
}

async function handleRegisterPasskey() {
  const btn    = document.getElementById('register-passkey-btn');
  const status = document.getElementById('passkey-status');
  btn.disabled    = true;
  btn.textContent = 'Setting up…';
  try {
    await registerPasskey(getAccessToken());
    status.textContent = 'Passkey added.';
    await loadPasskeys();
  } catch (err) {
    if (err.name === 'NotAllowedError' || /cancelled/i.test(err.message)) {
      status.textContent = 'Cancelled.';
    } else {
      status.textContent = `Failed: ${err.message}`;
    }
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Register passkey';
  }
}

async function handleDeletePasskey(id) {
  if (!confirm('Remove this passkey? You will not be able to sign in with it after.')) return;
  try {
    await deletePasskey(getAccessToken(), id);
    await loadPasskeys();
  } catch (err) {
    alert(`Couldn't remove passkey: ${err.message}`);
  }
}

function formatDate(ts) {
  if (!ts) return '';
  const ms = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : Date.parse(ts);
  return new Date(ms).toLocaleDateString();
}

// ── Helpers ─────────────────────────────────────────────────────

function escape(s) {
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

init();
