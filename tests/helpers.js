import { PilotQuota } from '../src/quota.js';
import { createSession, COOKIE } from '../src/auth.js';
export const PASSWORD = 'test-only-random-looking-password-DO-NOT-USE-LIVE';
export const ORIGIN = 'https://drafttopage.com';
export const EXAMPLE = {
  title: 'A little more room to work', excerpt: 'A small experiment in arranging a desk.',
  description: 'A personal update about clearing a work surface.', slug: 'room-to-work',
  body: 'This week, I moved my notebooks to a shelf beside my desk.\n\nI am still testing whether the setup feels better.',
  questions: ['Confirm that this sounds like your voice.']
};
export const INPUT = { notes: 'I moved notebooks from my desk to a shelf this week. I am still testing whether it feels better.', profile: 'personal', audience: '', purpose: '', consent: true };

export function mockStorage() {
  const records = new Map();
  let queue = Promise.resolve();
  const storage = {
    get: async key => structuredClone(records.get(key)),
    put: async (key, value) => { records.set(key, structuredClone(value)); },
    transaction: fn => {
      const next = queue.then(() => fn(storage));
      queue = next.catch(() => {});
      return next;
    }
  };
  return { storage, records };
}

export function environment() {
  const { storage, records } = mockStorage();
  const quota = new PilotQuota({ storage });
  const env = {
    PILOT_PASSWORD: PASSWORD, ANTHROPIC_API_KEY: 'not-a-real-api-key',
    PILOT_QUOTA: { idFromName: name => name, get: () => ({ fetch: (url, init) => quota.fetch(new Request(url, init)) }) },
    ASSETS: { fetch: async () => new Response('public site', { headers: { 'content-type': 'text/html' } }) }
  };
  return { env, storage, records, quota };
}

export async function authenticatedCookie(origin = ORIGIN) {
  return `${COOKIE}=${await createSession(PASSWORD, origin)}`;
}

export function request(path, { method = 'GET', body, cookie, origin = ORIGIN, headers = {} } = {}) {
  return new Request(`${origin}${path}`, { method, headers: {
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(method === 'POST' ? { origin, 'x-drafttopage': 'pilot-v1' } : {}),
    ...(cookie ? { cookie } : {}), ...headers
  }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}

export const providerResponse = (draft = EXAMPLE, stop = 'end_turn') => Response.json({ stop_reason: stop, content: [{ type: 'text', text: JSON.stringify(draft) }] });
