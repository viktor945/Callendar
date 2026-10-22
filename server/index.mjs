import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, createReadStream } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCore } from './core.mjs';

export async function createApp({ databasePath = process.env.DATABASE_PATH || resolve('.data/calendar.sqlite'), serveFrontend = true, pushOptions = {} } = {}) {
  const publicOrigin = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const core = createCore({ db, publicOrigin, pushOptions });
  let vite;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const url = new URL(req.url || '/', 'http://localhost');
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (!url.pathname.startsWith('/api/')) {
      if (!serveFrontend) return reply(404, { error: 'Not found' });
      if (vite) return vite.middlewares(req, res, () => reply(404, { error: 'Not found' }));
      const dist = resolve('dist');
      let file;
      try { file = resolve(dist, '.' + decodeURIComponent(url.pathname)); } catch { return reply(400, { error: 'Bad path' }); }
      if (!file.startsWith(dist + '/')) file = resolve(dist, 'index.html');
      if (!existsSync(file) || !extname(file)) file = resolve(dist, 'index.html');
      if (!existsSync(file)) return reply(503, { error: 'Run npm run build first' });
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
      if (url.pathname === '/sw.js') res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      const stream = createReadStream(file);
      stream.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); });
      stream.pipe(res);
      return;
    }
    return core.handle(req, res);
  });
  if (serveFrontend && process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  }
  return { server, db, async close() { await core.close(); await vite?.close(); await new Promise(resolve => server.close(resolve)); db.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, '0.0.0.0', () => console.log(`Вдвоём запущен на порту ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
