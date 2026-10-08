const encoder = new TextEncoder();
export const COOKIE = '__Host-dtp_session';
export const SESSION_SECONDS = 4 * 60 * 60;

export function authConfigured(env) {
  return typeof env.PILOT_PASSWORD === 'string' &&
    env.PILOT_PASSWORD.length >= 24 && env.PILOT_PASSWORD.length <= 256;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(`dtp-session-v1:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function passwordMatches(provided, expected) {
  if (typeof provided !== 'string' || provided.length > 256) return false;
  const [a, b] = await Promise.all([provided, expected].map(value =>
    crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

export async function createSession(secret, origin, now = Date.now()) {
  const payload = base64url(encoder.encode(JSON.stringify({
    version: 1, origin, expires: Math.floor(now / 1000) + SESSION_SECONDS,
    nonce: crypto.randomUUID()
  })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(payload));
  return `${payload}.${base64url(signature)}`;
}

export async function validSession(request, secret, now = Date.now()) {
  try {
    const cookies = (request.headers.get('cookie') || '').split(';').map(s => s.trim());
    const matches = cookies.filter(s => s.startsWith(`${COOKIE}=`));
    if (matches.length !== 1) return false;
    const token = matches[0].slice(COOKIE.length + 1);
    if (token.length > 1500) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify('HMAC', await signingKey(secret), decode(signature), encoder.encode(payload))) return false;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    const seconds = Math.floor(now / 1000);
    return data.version === 1 && data.origin === new URL(request.url).origin &&
      typeof data.nonce === 'string' && Number.isInteger(data.expires) &&
      data.expires > seconds && data.expires <= seconds + SESSION_SECONDS;
  } catch { return false; }
}

export function sessionCookie(token = '') {
  return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}`;
}
