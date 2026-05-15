// Direct WebAuthn integration with the Cognito user pool API.
// Uses the access-token-authenticated Cognito ops (no SigV4) — same auth model
// as GetUser, ChangePassword, etc. Browser does the WebAuthn ceremony locally;
// Cognito stores the resulting credential against the user.

import { COGNITO } from './config.js';

const ENDPOINT = `https://cognito-idp.${COGNITO.region}.amazonaws.com/`;

// ── Cognito API helper ──────────────────────────────────────────

async function cognitoCall(operation, body) {
  const res = await fetch(ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const msg = parsed.message || parsed.Message || parsed.__type || `${operation} failed (${res.status})`;
    throw new Error(msg);
  }
  return parsed;
}

// ── base64url ↔ ArrayBuffer ─────────────────────────────────────

function b64uToBuf(b64u) {
  const pad = (4 - (b64u.length % 4)) % 4;
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufToB64u(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Public API ──────────────────────────────────────────────────

export async function registerPasskey(accessToken) {
  const start = await cognitoCall('StartWebAuthnRegistration', { AccessToken: accessToken });
  const opts  = start.CredentialCreationOptions;

  // Cognito returns binary fields as base64url strings; the WebAuthn API needs ArrayBuffers.
  const publicKey = {
    ...opts,
    challenge: b64uToBuf(opts.challenge),
    user:      { ...opts.user, id: b64uToBuf(opts.user.id) },
    excludeCredentials: (opts.excludeCredentials || []).map(c => ({
      ...c,
      id: b64uToBuf(c.id),
    })),
  };

  const cred = await navigator.credentials.create({ publicKey });
  if (!cred) throw new Error('Passkey creation cancelled');

  const transports = cred.response.getTransports?.() || [];
  await cognitoCall('CompleteWebAuthnRegistration', {
    AccessToken: accessToken,
    Credential: {
      id:                       cred.id,
      rawId:                    bufToB64u(cred.rawId),
      type:                     cred.type,
      authenticatorAttachment:  cred.authenticatorAttachment,
      response: {
        clientDataJSON:    bufToB64u(cred.response.clientDataJSON),
        attestationObject: bufToB64u(cred.response.attestationObject),
        transports,
      },
      clientExtensionResults: cred.getClientExtensionResults?.() || {},
    },
  });

  return { id: cred.id };
}

export async function listPasskeys(accessToken) {
  const res = await cognitoCall('ListWebAuthnCredentials', {
    AccessToken: accessToken,
    MaxResults:  20,
  });
  return res.Credentials || [];
}

export async function deletePasskey(accessToken, credentialId) {
  await cognitoCall('DeleteWebAuthnCredential', {
    AccessToken:  accessToken,
    CredentialId: credentialId,
  });
}
