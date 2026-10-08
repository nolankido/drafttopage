// One object per deployment, shared by all pilot sessions. Stores counters only.
// SQLite-backed Durable Object binding is created by the Wrangler migration.
export class PilotQuota {
  constructor(state) { this.state = state; }
  async fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const action = new URL(request.url).pathname;
    if (!['/login', '/reserve'].includes(action)) return new Response(null, { status: 404 });
    const result = await this.state.storage.transaction(async tx => {
      const now = Date.now();
      const key = action === '/login' ? 'login-window' : 'generation-window';
      const previous = await tx.get(key);
      if (action === '/login') {
        const minute = Math.floor(now / 60000);
        const record = previous?.minute === minute ? previous : { minute, count: 0 };
        if (record.count >= 10) return { ok: false, retryAfter: 60, reason: 'login' };
        record.count++;
        await tx.put(key, record);
        return { ok: true };
      }
      const day = new Date(now).toISOString().slice(0, 10);
      const record = previous?.day === day ? previous : { day, count: 0, last: previous?.last ?? 0 };
      if (record.count >= 20) return { ok: false, retryAfter: Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86400000 - now) / 1000), reason: 'daily' };
      if (now - record.last < 30000) return { ok: false, retryAfter: Math.ceil((30000 - now + record.last) / 1000), reason: 'pace' };
      // Reserve before the provider call. Failures consume a slot, and nothing auto-retries.
      record.count++;
      record.last = now;
      await tx.put(key, record);
      return { ok: true, remaining: 20 - record.count };
    });
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  }
}
