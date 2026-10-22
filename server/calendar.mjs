import { randomBytes, createHash } from 'node:crypto';
import { calendarFile } from '../src/features/calendar/ical.ts';
const hash = token => createHash('sha256').update(token).digest('hex');
export function calendarModule({ db, origin, fail }) {
  db.exec('CREATE TABLE IF NOT EXISTS calendar_subscriptions (member_id TEXT PRIMARY KEY REFERENCES members(id), token_hash TEXT UNIQUE NOT NULL)');
  return ({ member, pathname, method, reply, res }) => {
    const route = /^\/api\/calendar\/feed\/([A-Za-z0-9_-]{32})\.ics$/.exec(pathname);
    if (route && method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      const owner = db.prepare('SELECT m.pair_id FROM calendar_subscriptions s JOIN members m ON m.id = s.member_id WHERE s.token_hash = ?').get(hash(route[1]));
      if (!owner) fail(404, 'Подписка отключена или ссылка недействительна.');
      const events = db.prepare('SELECT id, data, version FROM events WHERE pair_id = ?').all(owner.pair_id).map(row => ({ ...JSON.parse(row.data), id: row.id, version: row.version }));
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="vdvoem.ics"' });
      res.end(calendarFile(events)); return true;
    }
    if (pathname !== '/api/calendar/subscription') return false;
    if (!member) fail(401, 'Сначала подключите вашу пару.');
    const enabled = !!origin?.startsWith('https://');
    if (method === 'GET') { reply(200, { enabled, active: !!db.prepare('SELECT member_id FROM calendar_subscriptions WHERE member_id = ?').get(member.id) }); return true; }
    if (method === 'POST') {
      if (!enabled) fail(409, 'Автоматическая подписка требует серверной версии по HTTPS.');
      const token = randomBytes(24).toString('base64url');
      db.prepare('INSERT INTO calendar_subscriptions (member_id, token_hash) VALUES (?, ?) ON CONFLICT(member_id) DO UPDATE SET token_hash = excluded.token_hash').run(member.id, hash(token));
      reply(201, { url: `${origin.replace(/\/$/, '')}/api/calendar/feed/${token}.ics` }); return true;
    }
    if (method === 'DELETE') { db.prepare('DELETE FROM calendar_subscriptions WHERE member_id = ?').run(member.id); reply(200, { ok: true }); return true; }
    fail(405, 'Метод не поддерживается.');
  };
}
