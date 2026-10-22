import { DurableObject } from 'cloudflare:workers';
import webPush from 'web-push';
import { createCore } from '../server/core.mjs';

// Keep the existing synchronous SQL API and atomic transactions on Cloudflare's
// persistent SQLite storage; no local files or ephemeral container disk are used.
function database(storage) {
  return {
    exec: sql => storage.sql.exec(sql),
    transactionSync: action => storage.transactionSync(action),
    prepare: sql => ({
      get: (...args) => storage.sql.exec(sql, ...args).toArray()[0],
      all: (...args) => storage.sql.exec(sql, ...args).toArray(),
      run: (...args) => {
        storage.sql.exec(sql, ...args).toArray();
        return { changes: storage.sql.exec('SELECT changes() AS n').one().n };
      },
    }),
  };
}
async function sendPush(subscription, payload, options) {
  const request = webPush.generateRequestDetails(subscription, payload, options);
  const response = await fetch(request.endpoint, { method: request.method, headers: request.headers, body: new Uint8Array(request.body), signal: AbortSignal.timeout(7000), redirect: 'manual' });
  if (!response.ok) throw Object.assign(new Error('Push service rejected notification'), { statusCode: response.status });
  await response.body?.cancel();
}
async function* requestChunks(request) {
  if (!request.body) return;
  const reader = request.body.getReader();
  // Preserve split UTF-8 characters when the shared JSON parser joins chunks.
  const decoder = new TextDecoder();
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; yield decoder.decode(value, { stream: true }); }
    yield decoder.decode();
  } finally { reader.releaseLock(); }
}
export class CalendarServer extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = null; this.origin = null; }
  async fetch(request) {
    const origin = new URL(request.url).origin;
    if (this.origin && this.origin !== origin) return Response.json({ error: 'Откройте основной адрес приложения.' }, { status: 403 });
    if (!this.core) {
      this.origin = origin;
      this.core = createCore({ db: database(this.ctx.storage), publicOrigin: origin, runtime: 'cloudflare', pushOptions: { send: sendPush, waitUntil: task => this.ctx.waitUntil(task) } });
    }
    let status = 200, result;
    const headers = new Headers();
    const res = {
      headersSent: false,
      setHeader: (name, value) => headers.set(name, value),
      writeHead(code, values = {}) { status = code; for (const [name, value] of Object.entries(values)) headers.set(name, value); this.headersSent = true; },
      end(body = '') { result = new Response(body, { status, headers }); },
    };
    const req = {
      url: request.url, method: request.method,
      headers: Object.fromEntries(request.headers),
      socket: { encrypted: origin.startsWith('https:'), remoteAddress: request.headers.get('CF-Connecting-IP') || 'unknown' },
      [Symbol.asyncIterator]: () => requestChunks(request),
    };
    await this.core.handle(req, res);
    return result || Response.json({ error: 'Не найдено' }, { status: 404 });
  }
}
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      const id = env.CALENDAR.idFromName('calendar-server-v1');
      return env.CALENDAR.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
