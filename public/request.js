// No automatic retries: an interrupted generation can still consume an attempt.
export class PilotRequestError extends Error {
  constructor(message, status = 0, retryAfter = 0) {
    super(message);
    this.name = 'PilotRequestError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
async function readResponse(response, signal) {
  const max = 128 * 1024;
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body) {
    throw new Error('Invalid response');
  }
  if (Number(response.headers.get('content-length')) > max) throw new Error('Oversized response');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error('Aborted');
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('Aborted');
      if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new Error('Oversized response'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
    return data;
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}
export async function pilotRequest(path, value, { fetchImpl = globalThis.fetch, timeoutMs = 75000 } = {}) {
  if (!['session', 'generate', 'login', 'logout'].includes(path)) throw new PilotRequestError('Unknown pilot request.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(`/api/pilot/${path}`, {
      method: value === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-drafttopage': 'pilot-v1' }, signal: controller.signal,
      ...(value === undefined ? {} : { body: JSON.stringify(value) })
    });
    const data = await readResponse(response, controller.signal);
    if (!response.ok) {
      const message = typeof data.error === 'string' && data.error.length <= 500 ? data.error : 'The pilot request failed. Your writing is unchanged.';
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new PilotRequestError(message, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0);
    }
    return data;
  } catch (error) {
    if (error instanceof PilotRequestError) throw error;
    if (controller.signal.aborted) throw new PilotRequestError('The request timed out. Your writing is unchanged. An attempt may have been counted; no automatic retry was made.');
    throw new PilotRequestError(response?.status === 401 ? 'Your session ended. Sign in in a new tab, then refresh the connection here.' :
      'The connection did not return a usable response. Your writing is unchanged. No automatic retry was made.', response?.status || 0);
  } finally { clearTimeout(timer); controller.abort(); }
}
