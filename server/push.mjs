import webPush from 'web-push';

// Notifications contain no event names, types, notes, positions or ratings.
export function pushModule({ db, fail, origin, send = webPush.sendNotification }) {
  db.exec(`CREATE TABLE IF NOT EXISTS app_keys (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
  const stored = db.prepare("SELECT value FROM app_keys WHERE name = 'vapid'").get();
  const keys = stored ? JSON.parse(stored.value) : webPush.generateVAPIDKeys();
  if (!stored) db.prepare('INSERT INTO app_keys VALUES (?, ?)').run('vapid', JSON.stringify(keys));
  const enabled = typeof origin === 'string' && /^https:\/\//.test(origin);
  const pending = new Set();
  const attempts = new Map();
  function subscriptionInput(input) {
    let url;
    try { url = new URL(input.endpoint); } catch { fail(400, 'Некорректная подписка уведомлений.'); }
    const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com');
    if (!allowed || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || input.endpoint.length > 2048 || url.hash) fail(400, 'Неподдерживаемый адрес службы уведомлений.');
    const validKey = (value, bytes) => typeof value === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(value) && value.length <= 100 && Buffer.from(value, 'base64url').length === bytes;
    if (!validKey(input.keys?.p256dh, 65) || !validKey(input.keys?.auth, 16)) fail(400, 'Некорректные ключи подписки.');
    return { endpoint: input.endpoint, keys: { p256dh: input.keys.p256dh, auth: input.keys.auth } };
  }
  function deliver(rows, message) {
    if (!enabled) return Promise.resolve({ sent: 0, failed: 0 });
    const task = Promise.all(rows.map(async row => {
      try {
        await send(JSON.parse(row.data), JSON.stringify({ title: 'Вдвоём', ...message }), { TTL: 86400, timeout: 7000, vapidDetails: { subject: origin, ...keys } });
        return true;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint);
        return false;
      }
    })).then(results => ({ sent: results.filter(Boolean).length, failed: results.filter(value => !value).length }));
    pending.add(task); task.finally(() => pending.delete(task)); return task;
  }
  function notifyPartner(member, message) {
    const rows = db.prepare('SELECT s.* FROM push_subscriptions s JOIN members m ON m.id = s.member_id WHERE m.pair_id = ? AND m.id != ? AND m.expires > ?').all(member.pair_id, member.id, Date.now());
    void deliver(rows, message);
  }
  async function handle({ member, pathname, method, body, reply }) {
    if (pathname === '/api/push/config' && method === 'GET') { reply(200, { enabled, publicKey: enabled ? keys.publicKey : null }); return true; }
    if (!pathname.startsWith('/api/push/')) return false;
    if (pathname === '/api/push/subscriptions' && method === 'DELETE') {
      if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) fail(400, 'Проверьте подписку.');
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?').run(body.endpoint, member.id);
      reply(200, { ok: true }); return true;
    }
    if (!enabled) fail(503, 'Уведомления станут доступны после публикации серверной версии по HTTPS.');
    if (pathname === '/api/push/subscriptions' && method === 'POST') {
      const subscription = subscriptionInput(body);
      const existing = db.prepare('SELECT member_id FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint);
      if (existing && existing.member_id !== member.id) fail(409, 'Этот браузер подключён к уведомлениям другого участника.');
      if (!existing && db.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE member_id = ?').get(member.id).n >= 10) fail(400, 'Уже подключено 10 устройств. Отключите уведомления на одном из них.');
      db.prepare('INSERT INTO push_subscriptions VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(subscription.endpoint, member.id, JSON.stringify(subscription), Date.now());
      reply(201, { ok: true }); return true;
    }
    if (pathname === '/api/push/test' && method === 'POST') {
      const last = attempts.get(member.id) || 0;
      if (Date.now() - last < 30000) fail(429, 'Повторите проверку через 30 секунд.');
      if (attempts.size > 10000) attempts.clear();
      attempts.set(member.id, Date.now());
      const rows = db.prepare('SELECT * FROM push_subscriptions WHERE member_id = ?').all(member.id);
      if (!rows.length) fail(409, 'Сначала включите уведомления на этом устройстве.');
      const result = await deliver(rows, { body: 'Уведомления подключены. Ваши общие планы теперь рядом.', url: '/', tag: 'connection-test' });
      if (!result.sent) fail(502, 'Служба уведомлений не приняла сообщение. Попробуйте переподключить уведомления.');
      reply(200, result); return true;
    }
    return false;
  }
  return { handle, notifyPartner, async close() { await Promise.allSettled([...pending]); } };
}
