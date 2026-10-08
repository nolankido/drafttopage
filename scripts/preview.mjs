// Local-only QA server. Never imported by the production Worker. No real API calls.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { handleRequest } from '../src/worker.js';
import { environment, PASSWORD, providerResponse } from '../tests/helpers.js';
const root = resolve('public'), port = 8790;
const { env } = environment();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
env.ASSETS.fetch = async request => {
  try {
    let file = resolve(root, `.${decodeURIComponent(new URL(request.url).pathname)}`);
    if (file !== root && !file.startsWith(`${root}/`)) return new Response(null, { status: 403 });
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    return new Response(await readFile(file), { headers: { 'content-type': types[extname(file)] || 'text/plain' } });
  } catch { return new Response('Not found', { status: 404 }); }
};
createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of incoming) { bytes += chunk.length; if (bytes > 100000) { outgoing.writeHead(413).end(); return; } chunks.push(chunk); }
    const req = new Request(`http://localhost:${port}${incoming.url}`, { method: incoming.method, headers: incoming.headers,
      ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Buffer.concat(chunks) }) });
    const response = await handleRequest(req, env, { fetchProvider: async () => providerResponse() });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500).end('Local QA error'); }
}).listen(port, '127.0.0.1', () => console.log(`LOCAL MOCK ONLY: http://localhost:${port}/pilot\nTest password: ${PASSWORD}\nNo live Claude requests or production storage are used.`));
