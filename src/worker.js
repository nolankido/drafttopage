import { authConfigured, createSession, passwordMatches, sessionCookie, validSession } from './auth.js';
import { PilotError, PROFILES, validateInput, generateDraft } from './drafting.js';
import { appPage, loginPage, unavailablePage } from './pages.js';
export { PilotQuota } from './quota.js';

const CANONICAL_ORIGIN = 'https://drafttopage.com';
const MAX_BODY_BYTES = 48000;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

function secure(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries({
    'cache-control': 'no-store, private', 'content-security-policy': CSP,
    'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  })) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });

async function readJSON(request, limit) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new PilotError(415, 'Send JSON from the pilot page.');
  if (Number(request.headers.get('content-length') || 0) > limit) throw new PilotError(413, 'The request is too large. Shorten the notes.');
  if (!request.body) throw new PilotError(400, 'The request body is missing.');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new PilotError(413, 'The request is too large. Shorten the notes.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new PilotError(400, 'The request is not valid JSON.'); }
}

async function reserve(env, action) {
  if (!env.PILOT_QUOTA) throw new PilotError(503, 'The owner needs to finish configuring pilot access and usage protection.');
  let result;
  try {
    const id = env.PILOT_QUOTA.idFromName('private-pilot-v1');
    const response = await env.PILOT_QUOTA.get(id).fetch(`https://quota.internal/${action}`, { method: 'POST' });
    if (!response.ok) throw new Error();
    result = await response.json();
    if (typeof result.ok !== 'boolean') throw new Error();
  } catch { throw new PilotError(503, 'Usage protection is unavailable. No AI request was made.'); }
  if (!result.ok) {
    const message = result.reason === 'daily' ? 'The shared daily limit is reached. It resets at midnight UTC.' :
      result.reason === 'login' ? 'Too many sign-in attempts. Wait a minute before trying again.' : 'Wait at least 30 seconds between generation attempts.';
    throw new PilotError(429, message, Number(result.retryAfter) || 60);
  }
  return result;
}

function checkMutation(request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin || request.headers.get('x-drafttopage') !== 'pilot-v1' ||
      request.headers.get('sec-fetch-site') === 'cross-site') throw new PilotError(403, 'Use the form on this website to continue.');
}

// Dependencies are injectable only by local tests, never through HTTP or environment bindings.
export async function handleRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);
  const pilot = url.pathname === '/pilot' || url.pathname.startsWith('/pilot/');
  const api = url.pathname.startsWith('/api/');
  if (!pilot && !api) return env.ASSETS.fetch(request);
  try {
    if (url.search) throw new PilotError(400, 'Pilot requests must not contain URL parameters.');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!local && url.origin !== CANONICAL_ORIGIN) {
      if (pilot && request.method === 'GET') return secure(new Response(null, { status: 303, headers: { location: `${CANONICAL_ORIGIN}/pilot` } }));
      throw new PilotError(403, 'Use the pilot at drafttopage.com.');
    }
    if (!local && url.protocol !== 'https:') throw new PilotError(403, 'HTTPS is required.');
    if (pilot) {
      if (!['GET', 'HEAD'].includes(request.method)) return secure(json({ error: 'Method not allowed.' }, 405, { allow: 'GET, HEAD' }));
      if (!['/pilot', '/pilot/'].includes(url.pathname)) return secure(html('Not found.', 404));
      const ready = authConfigured(env) && Boolean(env.PILOT_QUOTA);
      const authenticated = ready && await validSession(request, env.PILOT_PASSWORD);
      const response = html(ready ? (authenticated ? appPage : loginPage) : unavailablePage, ready ? 200 : 503);
      if (request.method === 'HEAD') return secure(new Response(null, { status: response.status, headers: response.headers }));
      return secure(response);
    }
    const route = url.pathname;
    const methods = { '/api/pilot/login': 'POST', '/api/pilot/logout': 'POST', '/api/pilot/session': 'GET', '/api/pilot/generate': 'POST' };
    if (!Object.hasOwn(methods, route)) return secure(json({ error: 'Not found.' }, 404));
    if (request.method !== methods[route]) return secure(json({ error: 'Method not allowed.' }, 405, { allow: methods[route] }));
    if (request.method === 'POST') checkMutation(request);
    if (route === '/api/pilot/logout') return secure(json({ ok: true }, 200, { 'set-cookie': sessionCookie() }));
    if (!authConfigured(env)) throw new PilotError(503, 'The private pilot is not activated yet.');
    if (route === '/api/pilot/login') {
      await reserve(env, 'login');
      const input = await readJSON(request, 2048);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join() !== 'password' ||
          !await passwordMatches(input.password, env.PILOT_PASSWORD)) throw new PilotError(401, 'The password was not accepted.');
      return secure(json({ ok: true }, 200, { 'set-cookie': sessionCookie(await createSession(env.PILOT_PASSWORD, url.origin)) }));
    }
    if (!await validSession(request, env.PILOT_PASSWORD)) throw new PilotError(401, 'Your session has ended. Sign in again in a new tab to keep these notes.');
    if (route === '/api/pilot/session') return secure(json({ authenticated: true,
      generationReady: Boolean(env.ANTHROPIC_API_KEY && env.PILOT_QUOTA),
      profiles: PROFILES, limits: { notes: 8000, dailyAttempts: 20, spacingSeconds: 30 } }));
    const input = validateInput(await readJSON(request, MAX_BODY_BYTES));
    if (!env.ANTHROPIC_API_KEY) throw new PilotError(503, 'AI generation is not activated. The owner needs to add the API credential.');
    const allowance = await reserve(env, 'reserve');
    const draft = await generateDraft(input, env.ANTHROPIC_API_KEY, dependencies.fetchProvider || fetch);
    return secure(json({ draft, remainingToday: allowance.remaining }));
  } catch (error) {
    const expected = error instanceof PilotError;
    return secure(json({ error: expected ? error.message : 'The request could not be completed. Your notes have been kept.' },
      expected ? error.status : 500, expected && error.retryAfter ? { 'retry-after': String(error.retryAfter) } : {}));
  }
}

export default { fetch(request, env) { return handleRequest(request, env); } };
