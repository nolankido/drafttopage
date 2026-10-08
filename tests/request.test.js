import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotRequest, PilotRequestError } from '../public/request.js';
test('Pilot requests stay on the same origin, disable cache, and use one request', async () => {
  let calls = 0;
  const result = await pilotRequest('generate', { notes: 'fictional' }, { fetchImpl: async (url, options) => {
    calls++; assert.equal(url, '/api/pilot/generate'); assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers['x-drafttopage'], 'pilot-v1'); assert.ok(options.signal);
    assert.equal(JSON.parse(options.body).notes, 'fictional'); return Response.json({ ok: true });
  } });
  assert.deepEqual(result, { ok: true }); assert.equal(calls, 1);
});
test('Session refresh is read-only and contains no writing', async () => {
  await pilotRequest('session', undefined, { fetchImpl: async (_, options) => {
    assert.equal(options.method, 'GET'); assert.ok(!Object.hasOwn(options, 'body')); return Response.json({ ok: true });
  } });
});
test('Error status and bounded retry guidance are preserved', async () => {
  await assert.rejects(pilotRequest('generate', {}, { fetchImpl: async () => Response.json({ error: 'Wait.' }, { status: 429, headers: { 'retry-after': '30' } }) }), error => error instanceof PilotRequestError && error.status === 429 && error.retryAfter === 30);
});
for (const [name, response] of [
  ['HTML error', () => new Response('<html>private upstream detail</html>', { status: 502, headers: { 'content-type': 'text/html' } })],
  ['malformed JSON', () => new Response('{bad', { headers: { 'content-type': 'application/json' } })],
  ['null response', () => Response.json(null)],
  ['array response', () => Response.json([])],
  ['oversized response', () => Response.json({ text: 'x'.repeat(140000) })],
  ['invalid UTF-8', () => new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } })]
]) test(`Malformed upstream handling: ${name}`, async () => {
  let calls = 0;
  await assert.rejects(pilotRequest('generate', {}, { fetchImpl: async () => { calls++; return response(); } }), error => /writing is unchanged/.test(error.message) && !error.message.includes('private upstream detail'));
  assert.equal(calls, 1);
});
test('HTML authentication error still requests a new sign-in, without leaking HTML', async () => {
  await assert.rejects(pilotRequest('session', undefined, { fetchImpl: async () => new Response('<h1>Unauthorized</h1>', { status: 401 }) }), error => error.status === 401 && error.message.includes('new tab'));
});
test('A disconnected request is not retried', async () => {
  let calls = 0;
  await assert.rejects(pilotRequest('generate', {}, { fetchImpl: async () => { calls++; throw new TypeError('fetch failed'); } }), /No automatic retry/);
  assert.equal(calls, 1);
});
test('Timeout cancels an outstanding fetch without retrying', async () => {
  let calls = 0;
  await assert.rejects(pilotRequest('generate', {}, { timeoutMs: 5, fetchImpl: (_, { signal }) => {
    calls++; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }));
  } }), /timed out/);
  assert.equal(calls, 1);
});
test('Timeout also cancels a stalled response body and releases its reader', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(pilotRequest('generate', {}, { timeoutMs: 5, fetchImpl: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), /timed out/);
  assert.equal(cancelled, true); assert.equal(body.locked, false);
});
test('Arbitrary endpoint names cannot send requests', async () => {
  let called = false;
  await assert.rejects(pilotRequest('https://other.example', {}, { fetchImpl: () => { called = true; } }), /Unknown/);
  assert.equal(called, false);
});
