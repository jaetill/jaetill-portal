/**
 * Postmark email bodies for the portal's admin flows.
 *
 * Pure and dependency-free on purpose: this is the code that decides what an
 * invitee actually clicks, and it is the code that got the sign-in link wrong
 * for four months. Keeping it importable means it can be unit tested without
 * mocking the AWS SDK.
 *
 * Two variants, one body:
 *   'invite'   — first contact, sent by the create flow
 *   'reminder' — re-send to someone still stuck in FORCE_CHANGE_PASSWORD
 *
 * They differ only in subject and opening line. The credentials block and the
 * sign-in link are shared, so the two paths cannot drift apart again.
 *
 * `signInUrl` MUST be the portal (https://jaetill.com/), never the Cognito
 * custom domain. `just.jaetill.com` serves only /login, /oauth2/*, /logout and
 * /error — its root 404s. The portal is also the only correct target: a static
 * email link cannot carry a PKCE code_verifier, so it has to land on the app
 * and let the app start the authorize redirect itself.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COPY = {
  invite: {
    subject: "You've been invited to jaetill.com",
    lead: 'You have been invited to jaetill.com. Here is everything you need to sign in:',
  },
  reminder: {
    subject: 'Reminder: complete your jaetill.com sign-in',
    lead: 'We sent you an invitation to jaetill.com but you have not completed the sign-in yet. Here are fresh credentials:',
  },
};

function appsLine(appNames) {
  if (!appNames || appNames.length === 0) return null;
  return appNames.length === 1
    ? `You have been given access to ${appNames[0]}.`
    : `You have been given access to ${appNames.slice(0, -1).join(', ')} and ${appNames[appNames.length - 1]}.`;
}

/**
 * @param {object}   opts
 * @param {'invite'|'reminder'} opts.variant
 * @param {string}   opts.email        Address the invitee signs in with
 * @param {string}   opts.tempPassword One-time password; expires after 7 days
 * @param {string}   opts.signInUrl    Portal URL — see module note
 * @param {string[]} [opts.appNames]   Human-readable apps granted
 * @returns {{ subject: string, text: string, html: string }}
 */
function buildAccessEmail({ variant, email, tempPassword, signInUrl, appNames }) {
  const copy = COPY[variant];
  if (!copy) throw new Error(`Unknown email variant '${variant}'`);

  const apps = appsLine(appNames);

  const text = [
    'Hi,',
    '',
    copy.lead,
    '',
    `  Email:          ${email}`,
    `  Temp password:  ${tempPassword}`,
    `  Sign-in URL:    ${signInUrl}`,
    '',
    ...(apps ? [apps, ''] : []),
    "You'll be asked to set a permanent password the first time you sign in.",
    'The temporary password above expires in 7 days.',
    '',
    "If you weren't expecting this email, you can safely ignore it.",
  ].join('\n');

  const e = escapeHtml;
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi,</p>
  <p>${e(copy.lead)}</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
    <table style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;border-collapse:collapse;">
      <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Email</td><td style="padding:2px 0;color:#1e293b;"><strong>${e(email)}</strong></td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Temp password</td><td style="padding:2px 0;color:#1e293b;"><strong>${e(tempPassword)}</strong></td></tr>
    </table>
  </div>
  <p><a href="${e(signInUrl)}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Sign in</a></p>
  ${apps ? `<p>${e(apps)}</p>` : ''}
  <p>You'll be asked to set a permanent password the first time you sign in. The temporary password above expires in 7 days.</p>
  <p style="color:#64748b;font-size:13px;margin-top:24px;">If you weren't expecting this email, you can safely ignore it.</p>
</body></html>`;

  return { subject: copy.subject, text, html };
}

module.exports = { buildAccessEmail, escapeHtml };
