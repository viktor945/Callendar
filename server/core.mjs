import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { dateModule } from './dates.mjs';
import { pushModule } from './push.mjs';
import { calendarModule } from './calendar.mjs';
import { transaction } from './transaction.mjs';
import { sexTypes, sexTitle } from '../src/features/intimacy/sexTypes.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(24).toString('base64url');
const sessionDays = 180;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, 'Проверьте заполненные поля.');
  return value.trim();
}
function eventInput(body) {
  const kind = body.kind ?? 'date';
  if (!['date', 'intimacy'].includes(kind)) fail(400, 'Выберите тип встречи.');
  const date = text(body.date, 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail(400, 'Укажите корректную дату.');
  const time = text(body.time ?? '', 5, kind === 'date');
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, 'Укажите корректное время.');
  const category = body.category ?? (kind === 'intimacy' ? 'home' : undefined);
  if (!['date', 'home', 'adventure'].includes(category)) fail(400, 'Выберите формат свидания.');
  if (!['planned', 'completed'].includes(body.status)) fail(400, 'Некорректный статус.');
  const sexType = kind === 'intimacy' ? body.sexType === undefined ? 'unspecified' : body.sexType : null;
  if (kind === 'intimacy' && !sexTypes.some(type => type.id === sexType)) fail(400, 'Выберите корректный тип секса.');
  if (kind === 'date' && body.sexType != null) fail(400, 'Тип секса относится к интимной записи.');
  // Older clients may send their own title. New logs need only date and type.
  const title = kind === 'intimacy' && (body.title == null || (typeof body.title === 'string' && !body.title.trim())) ? sexTitle(sexType) : text(body.title, 100, true);
  let continuation = null;
  if (kind === 'intimacy' && body.continuation != null) fail(400, 'Продолжение относится к свиданию.');
  if (body.continuation != null) {
    const continuationTime = text(body.continuation.time, 5);
    if (continuationTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(continuationTime)) fail(400, 'Проверьте время продолжения.');
    continuation = { title: text(body.continuation.title, 100, true), time: continuationTime, wishes: text(body.continuation.wishes, 2000) };
  }
  const tags = body.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 24 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 40)) fail(400, 'Проверьте варианты встречи: до 24 названий.');
  if (kind === 'date' && tags.length) fail(400, 'Метки близости относятся к интимной встрече.');
  const positions = body.positions ?? [];
  if (!Array.isArray(positions) || positions.length > 20 || positions.some(value => typeof value !== 'string' || !value.trim() || value.length > 80)) fail(400, 'Проверьте названия поз: до 20 названий по 80 символов.');
  if (kind === 'date' && positions.length) fail(400, 'Позы относятся к записи секса.');
  const linkedDateId = body.linkedDateId ?? null;
  if (linkedDateId !== null && (kind !== 'intimacy' || typeof linkedDateId !== 'string' || !/^[a-f0-9-]{36}$/.test(linkedDateId))) fail(400, 'Проверьте связанное свидание.');
  return { title, date, time, sexType, location: text(body.location ?? '', 200), category, note: text(body.note ?? '', 2000), status: body.status, continuation, kind, tags: [...new Set(tags.map(tag => tag.trim()))], positions: [...new Set(positions.map(value => value.trim()))], linkedDateId };
}

export function createCore({ db, publicOrigin, pushOptions = {}, runtime = 'node' }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pairs (id TEXT PRIMARY KEY, invite_hash TEXT, invite_expires INTEGER);
    CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id), name TEXT NOT NULL, session_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS private_notes (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), note TEXT NOT NULL, PRIMARY KEY (event_id, member_id));
    CREATE TABLE IF NOT EXISTS pair_settings (pair_id TEXT PRIMARY KEY REFERENCES pairs(id), relationship_mode TEXT NOT NULL DEFAULT 'dating', partner_label TEXT NOT NULL DEFAULT '', weekly_goal INTEGER, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS private_reflections (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), PRIMARY KEY(event_id, member_id));`);
  // Additive, repeatable migration: existing events, sessions and notes stay intact.
  db.prepare('INSERT OR IGNORE INTO pair_settings (pair_id) SELECT id FROM pairs').run();
  const streams = new Map();
  const attempts = new Map();
  function broadcast(pairId) {
    for (const client of streams.get(pairId) || []) client.write('event: change\ndata: {}\n\n');
  }
  function state(member) {
    return {
      memberId: member.id,
      profile: profile(member.pair_id),
      members: db.prepare('SELECT id, name FROM members WHERE pair_id = ? ORDER BY rowid').all(member.pair_id),
      events: db.prepare('SELECT id, data, version FROM events WHERE pair_id = ?').all(member.pair_id).map(row => ({ kind: 'date', tags: [], linkedDateId: null, ...JSON.parse(row.data), id: row.id, version: row.version })),
    };
  }
  function profile(pairId) {
    const row = db.prepare('SELECT * FROM pair_settings WHERE pair_id = ?').get(pairId);
    return { relationshipMode: row.relationship_mode, partnerLabel: row.partner_label, weeklyGoal: row.weekly_goal, version: row.version };
  }
  function profileInput(body) {
    if (!['dating', 'couple'].includes(body.relationshipMode)) fail(400, 'Выберите формат отношений.');
    const weeklyGoal = body.weeklyGoal ?? null;
    if (weeklyGoal !== null && (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > 14)) fail(400, 'Пожелание по частоте: от 1 до 14 встреч в неделю.');
    return { relationshipMode: body.relationshipMode, partnerLabel: text(body.partnerLabel ?? '', 40), weeklyGoal };
  }
  function checkLink(member, data, currentId) {
    if (data.linkedDateId) {
      const linked = scopedEvent(member, data.linkedDateId);
      if ((JSON.parse(linked.data).kind ?? 'date') !== 'date') fail(400, 'Можно связать только со свиданием.');
    }
    if (currentId && data.kind !== 'date') {
      const children = db.prepare("SELECT id FROM events WHERE pair_id = ? AND json_extract(data, '$.linkedDateId') = ?").all(member.pair_id, currentId);
      if (children.length) fail(409, 'Сначала уберите связь с этим свиданием у интимных встреч.');
    }
  }
  function authenticate(req) {
    const token = /(?:^|;\s*)vdvoem_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '')?.[1];
    return token ? db.prepare('SELECT * FROM members WHERE session_hash = ? AND expires > ?').get(hash(token), Date.now()) : null;
  }
  function cookie(req, res, token) {
    // PUBLIC_ORIGIN must be the canonical HTTPS origin behind a deployment proxy.
    const secure = publicOrigin?.startsWith('https://') || req.socket.encrypted;
    res.setHeader('Set-Cookie', `vdvoem_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionDays * 86400}${secure ? '; Secure' : ''}`);
  }
  function scopedEvent(member, id) {
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND pair_id = ?').get(id, member.pair_id);
    if (!event) fail(404, 'Встреча не найдена.');
    return event;
  }
  const handleCalendar = calendarModule({ db, origin: publicOrigin, fail });
  const push = pushModule({ db, fail, origin: publicOrigin, ...pushOptions });
  const handleDates = dateModule({ db, broadcast, fail, notifyPartner: push.notifyPartner });
  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      let body = {};
      if (!['GET', 'HEAD'].includes(req.method)) {
        const expectedOrigin = publicOrigin || `http://${req.headers.host}`;
        if (req.headers.origin && req.headers.origin !== expectedOrigin) fail(403, 'Запрос с другого сайта отклонён.');
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Expected application/json');
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          const limit = url.pathname.startsWith('/api/dates/') ? 512 * 1024 : 16384;
          if (Buffer.byteLength(raw) > limit) fail(413, 'Слишком большой запрос.');
        }
        try { body = JSON.parse(raw || '{}'); } catch { fail(400, 'Некорректный запрос.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Некорректный запрос.');
      }
      const member = authenticate(req);
      if (handleCalendar({ member, pathname: url.pathname, method: req.method, reply, res })) return;
      if (url.pathname === '/api/runtime' && req.method === 'GET') return reply(200, { sync: runtime === 'cloudflare' ? 'poll' : 'sse', intervalMs: 15000 });
      if (runtime === 'cloudflare' && url.pathname === '/api/stream') return reply(409, { error: 'Use polling on Cloudflare.' });
      if (url.pathname === '/api/health' && req.method === 'GET') return reply(200, { ok: true });
      if (url.pathname === '/api/session' && req.method === 'GET') return reply(200, member ? state(member) : null);
      if (url.pathname === '/api/pairs' && req.method === 'POST') {
        if (member) fail(409, 'Вы уже подключены к паре.');
        const name = text(body.name, 40, true);
        const settings = profileInput({ relationshipMode: body.relationshipMode ?? 'dating', partnerLabel: body.partnerLabel, weeklyGoal: body.weeklyGoal });
        const id = randomUUID(), memberId = randomUUID(), token = secret(), invite = secret();
        transaction(db, () => {
          db.prepare('INSERT INTO pairs (id, invite_hash, invite_expires) VALUES (?, ?, ?)').run(id, hash(invite), Date.now() + 7 * 86400000);
          db.prepare('INSERT INTO members (id, pair_id, name, session_hash, expires) VALUES (?, ?, ?, ?, ?)').run(memberId, id, name, hash(token), Date.now() + sessionDays * 86400000);
          db.prepare('INSERT INTO pair_settings (pair_id, relationship_mode, partner_label, weekly_goal) VALUES (?, ?, ?, ?)').run(id, settings.relationshipMode, settings.partnerLabel, settings.weeklyGoal);
        });
        cookie(req, res, token);
        return reply(201, { ...state({ id: memberId, pair_id: id }), invite });
      }
      if (url.pathname === '/api/join' && req.method === 'POST') {
        if (member) fail(409, 'Вы уже подключены к паре. Откройте приглашение в другом профиле браузера.');
        const name = text(body.name, 40, true), invite = text(body.invite, 80, true);
        const ip = req.socket.remoteAddress;
        if (attempts.size > 10000) for (const [key, value] of attempts) if (Date.now() - value.start > 900000) attempts.delete(key);
        let limit = attempts.get(ip);
        if (!limit || Date.now() - limit.start > 900000) { limit = { count: 0, start: Date.now() }; attempts.set(ip, limit); }
        if (++limit.count > 30) fail(429, 'Слишком много попыток. Попробуйте через 15 минут.');
        const pair = db.prepare('SELECT * FROM pairs WHERE invite_hash = ? AND invite_expires > ?').get(hash(invite), Date.now());
        if (!pair) fail(404, 'Приглашение недействительно или уже использовано. Попросите новую ссылку.');
        if (db.prepare('SELECT count(*) AS count FROM members WHERE pair_id = ?').get(pair.id).count >= 2) fail(409, 'В этом календаре уже два партнёра.');
        const memberId = randomUUID(), token = secret();
        transaction(db, () => {
          db.prepare('INSERT INTO members (id, pair_id, name, session_hash, expires) VALUES (?, ?, ?, ?, ?)').run(memberId, pair.id, name, hash(token), Date.now() + sessionDays * 86400000);
          db.prepare('UPDATE pairs SET invite_hash = NULL WHERE id = ?').run(pair.id);
        });
        cookie(req, res, token);
        broadcast(pair.id);
        return reply(200, state({ id: memberId, pair_id: pair.id }));
      }
      if (!member) fail(401, 'Сначала создайте общий календарь или примите приглашение.');
      if (await push.handle({ member, pathname: url.pathname, method: req.method, body, reply })) return;
      if (handleDates({ member, pathname: url.pathname, method: req.method, body, reply })) return;
      if (url.pathname === '/api/pair/profile' && req.method === 'PATCH') {
        const data = profileInput(body);
        if (!Number.isInteger(body.version) || body.version < 1) fail(400, 'Проверьте версию настроек.');
        const result = db.prepare('UPDATE pair_settings SET relationship_mode = ?, partner_label = ?, weekly_goal = ?, version = version + 1 WHERE pair_id = ? AND version = ?').run(data.relationshipMode, data.partnerLabel, data.weeklyGoal, member.pair_id, body.version);
        if (!result.changes) fail(409, 'Партнёр изменил настройки. Откройте их снова.');
        broadcast(member.pair_id);
        return reply(200, profile(member.pair_id));
      }
      if (url.pathname === '/api/invite' && req.method === 'POST') {
        if (state(member).members.length === 2) fail(409, 'Ваш партнёр уже подключён.');
        const invite = secret();
        db.prepare('UPDATE pairs SET invite_hash = ?, invite_expires = ? WHERE id = ?').run(hash(invite), Date.now() + 7 * 86400000, member.pair_id);
        return reply(200, { invite });
      }
      if (url.pathname === '/api/stream' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        if (!streams.has(member.pair_id)) streams.set(member.pair_id, new Set());
        streams.get(member.pair_id).add(res);
        res.write('event: ready\ndata: {}\n\n');
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
        res.on('close', () => { clearInterval(heartbeat); const clients = streams.get(member.pair_id); clients?.delete(res); if (!clients?.size) streams.delete(member.pair_id); });
        return;
      }
      if (url.pathname === '/api/events' && req.method === 'POST') {
        const data = eventInput(body), id = randomUUID();
        checkLink(member, data);
        db.prepare('INSERT INTO events (id, pair_id, data) VALUES (?, ?, ?)').run(id, member.pair_id, JSON.stringify(data));
        broadcast(member.pair_id);
        if (data.status === 'planned') push.notifyPartner(member, { body: 'Партнёр добавил встречу в ваш общий календарь.', url: '/', tag: `event-${id}` });
        return reply(201, { ...data, id, version: 1 });
      }
      const route = /^\/api\/events\/([a-f0-9-]+)(\/private)?$/.exec(url.pathname);
      if (route) {
        const event = scopedEvent(member, route[1]);
        if (route[2]) {
          if (req.method === 'GET') return reply(200, { note: db.prepare('SELECT note FROM private_notes WHERE event_id = ? AND member_id = ?').get(event.id, member.id)?.note || '', rating: db.prepare('SELECT rating FROM private_reflections WHERE event_id = ? AND member_id = ?').get(event.id, member.id)?.rating ?? null });
          if (req.method === 'PUT') {
            const note = text(body.note, 4000);
            if (body.rating !== undefined && body.rating !== null) {
              const data = JSON.parse(event.data);
              if (data.kind !== 'intimacy' || data.status !== 'completed' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) fail(400, 'Оценка от 1 до 5 доступна после состоявшейся близости.');
            }
            transaction(db, () => {
              db.prepare('INSERT INTO private_notes VALUES (?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET note = excluded.note').run(event.id, member.id, note);
              if (body.rating === null) db.prepare('DELETE FROM private_reflections WHERE event_id = ? AND member_id = ?').run(event.id, member.id);
              else if (body.rating !== undefined) db.prepare('INSERT INTO private_reflections VALUES (?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET rating = excluded.rating').run(event.id, member.id, body.rating);
            });
            return reply(200, { note });
          }
        } else if (req.method === 'PATCH') {
          if (!Number.isInteger(body.version) || body.version < 1) fail(400, 'Некорректная версия встречи.');
          const data = eventInput(body);
          checkLink(member, data, event.id);
          const changed = db.prepare('UPDATE events SET data = ?, version = version + 1 WHERE id = ? AND version = ?').run(JSON.stringify(data), event.id, body.version ?? -1);
          if (!changed.changes) fail(409, 'Партнёр уже изменил встречу. Закройте окно и откройте её снова.');
          broadcast(member.pair_id);
          if (data.status === 'planned') push.notifyPartner(member, { body: 'Партнёр изменил общий план. Посмотрите обновление.', url: '/', tag: `event-${event.id}` });
          return reply(200, { ...data, id: event.id, version: event.version + 1 });
        } else if (req.method === 'DELETE') {
          if (!Number.isInteger(body.version) || body.version < 1) fail(400, 'Некорректная версия встречи.');
          transaction(db, () => {
            const changed = db.prepare('DELETE FROM events WHERE id = ? AND version = ?').run(event.id, body.version);
            if (!changed.changes) fail(409, 'Встреча изменилась. Откройте её снова перед удалением.');
            db.prepare("UPDATE events SET data = json_set(data, '$.linkedDateId', NULL), version = version + 1 WHERE pair_id = ? AND json_extract(data, '$.linkedDateId') = ?").run(member.pair_id, event.id);
          });
          broadcast(member.pair_id);
          if (JSON.parse(event.data).status === 'planned') push.notifyPartner(member, { body: 'Партнёр отменил встречу в общем календаре.', url: '/', tag: `event-${event.id}` });
          return reply(200, { ok: true });
        }
      }
      return reply(404, { error: 'Не найдено' });
    } catch (error) {
      if (!error.status) console.error('API error:', error.message);
      if (!res.headersSent) reply(error.status || 500, { error: error.status ? error.message : 'Ошибка сервера. Попробуйте снова.' });
      else res.end();
    }
  }
  return { handle, async close() { for (const clients of streams.values()) for (const client of clients) client.end(); await push.close(); } };
}
