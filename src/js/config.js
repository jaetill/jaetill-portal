// Cognito Hosted UI config. All values here are non-secret —
// the App Client has no client secret (PKCE-only public client).
//
// Replace the TBD values once Cognito provisioning is complete.

const PROD_ORIGIN = 'https://jaetill.com';
const DEV_ORIGIN  = 'http://localhost:5173';

const origin = import.meta.env.DEV ? DEV_ORIGIN : PROD_ORIGIN;

export const COGNITO = {
  region:      'us-east-2',
  userPoolId:  'us-east-2_xneeJzaDJ',
  domain:      'just.jaetill.com',
  clientId:    '46otpmd24oi6mul3seod77b2k0',
  redirectUri: `${origin}/callback.html`,
  logoutUri:   `${origin}/`,
  // aws.cognito.signin.user.admin is required for access-token-authenticated user-pool ops
  // (passkey register/list/delete, change-password, get-user, etc.).
  scopes:      ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
};

export const API_BASE = 'https://eqidhh18u2.execute-api.us-east-2.amazonaws.com/prod';
