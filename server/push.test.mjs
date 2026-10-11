import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { createApp } from './index.mjs';
import webPush from 'web-push';

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const subscription = suffix => ({ endpoint: `https://web.push.apple.com/${suffix}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 5).toString('base64url') } });
const planned = { kind: 'intimacy', title: 'Личное название', date: '2026-10-20', time: '21:00', status: 'planned', tags: ['Свечи'], positions: ['Наш вариант'], note: 'Личные подробности' };
async function setup(t, failingEndpoint = '') {
  const dir = mkdtempSync(join(tmpdir(), 'vdvoem-push-')); const databasePath = join(dir, 'db.sqlite');
  const deliveries = [];
  const send = async (sub, payload, options) => {
    if (sub.endpoint === failingEndpoint) throw Object.assign(new Error('expired'), { statusCode: 410 });
    deliveries.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), options });
  };
  let app, base;
  async function start() { app = await createApp({ databasePath, serveFrontend: false, pushOptions: { origin: 'https://calendar.example', send } }); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${app.server.address().port}/api`; }
  await start(); t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const client = () => { let cookie = ''; return async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  }; };
  const a = client(), b = client(), other = client(), anonymous = client();
  const pair = await a('/pairs', 'POST', { name: 'А' });
  await b('/join', 'POST', { name: 'Б', invite: pair.data.invite });
  await other('/pairs', 'POST', { name: 'Другая пара' });
  return { a, b, other, anonymous, deliveries, get app() { return app; }, async restart() { await app.close(); await start(); } };
}

test('subscriptions are authenticated, scoped to a member and persist with stable VAPID keys', async t => {
  const f = await setup(t);
  assert.equal((await f.anonymous('/push/config')).status, 401);
  const config = (await f.a('/push/config')).data;
  assert.equal(config.enabled, true); assert.equal(typeof config.publicKey, 'string'); assert.ok(!('privateKey' in config));
  assert.equal((await f.a('/push/subscriptions', 'POST', subscription('a'))).status, 201);
  assert.equal((await f.b('/push/subscriptions', 'POST', subscription('a'))).status, 409);
  assert.equal((await f.b('/push/subscriptions', 'POST', subscription('b'))).status, 201);
  await f.other('/push/subscriptions', 'DELETE', { endpoint: subscription('a').endpoint });
  assert.equal(f.app.db.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n, 2);
  await f.restart();
  assert.deepEqual((await f.a('/push/config')).data, config);
  const result = await f.a('/push/test', 'POST', {});
  assert.equal(result.status, 200); assert.equal(result.data.sent, 1);
  assert.equal(f.deliveries[0].endpoint, subscription('a').endpoint);
  assert.equal(f.deliveries[0].options.vapidDetails.publicKey, config.publicKey);
  const request = webPush.generateRequestDetails(subscription('a'), JSON.stringify(f.deliveries[0].payload), f.deliveries[0].options);
  assert.equal(request.headers['Content-Encoding'], 'aes128gcm');
  assert.match(request.headers.Authorization, /^vapid /);
  assert.ok(Buffer.isBuffer(request.body));
  assert.ok(!request.body.includes(Buffer.from('Уведомления подключены')));
  assert.equal((await f.a('/push/test', 'POST', {})).status, 429);
  await f.a('/push/subscriptions', 'DELETE', { endpoint: subscription('a').endpoint });
  assert.equal(f.app.db.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n, 1);
});

test('unsafe endpoints and malformed subscriptions are rejected before any network request', async t => {
  const f = await setup(t);
  for (const endpoint of ['http://web.push.apple.com/x', 'https://127.0.0.1/x', 'https://web.push.apple.com.attacker.test/x', 'https://user:password@web.push.apple.com/x', 'https://web.push.apple.com:444/x', 'https://web.push.apple.com/x#fragment']) {
    assert.equal((await f.a('/push/subscriptions', 'POST', { ...subscription('a'), endpoint })).status, 400);
  }
  assert.equal((await f.a('/push/subscriptions', 'POST', { ...subscription('a'), keys: { p256dh: 'invalid', auth: 'invalid' } })).status, 400);
  assert.equal(f.deliveries.length, 0);
});

test('only the partner receives neutral pushes for plans; facts and private notes do not send pushes', async t => {
  const f = await setup(t);
  await f.a('/push/subscriptions', 'POST', subscription('a'));
  await f.b('/push/subscriptions', 'POST', subscription('b'));
  await f.other('/push/subscriptions', 'POST', subscription('other'));
  const created = await f.a('/events', 'POST', planned); assert.equal(created.status, 201);
  assert.equal(f.deliveries.length, 1); assert.equal(f.deliveries[0].endpoint, subscription('b').endpoint);
  const payload = JSON.stringify(f.deliveries[0].payload);
  for (const privateText of [planned.title, planned.note, 'Наш вариант', 'Свечи', 'intimacy', 'секс']) assert.ok(!payload.includes(privateText));
  await f.a(`/events/${created.data.id}/private`, 'PUT', { note: 'Только для автора' });
  await f.a('/events', 'POST', { ...planned, status: 'completed', time: '' });
  assert.equal(f.deliveries.length, 1);
  const updated = await f.b(`/events/${created.data.id}`, 'PATCH', { ...created.data, title: 'Другое название' });
  assert.equal(updated.status, 200); assert.equal(f.deliveries.at(-1).endpoint, subscription('a').endpoint);
  await f.b(`/events/${created.data.id}`, 'DELETE', { version: updated.data.version });
  assert.equal(f.deliveries.length, 3);
});

test('invitations push to recipient, acceptance pushes to author once, expired subscriptions are removed', async t => {
  const f = await setup(t, subscription('expired').endpoint);
  await f.a('/push/subscriptions', 'POST', subscription('a'));
  await f.b('/push/subscriptions', 'POST', subscription('b'));
  await f.b('/push/subscriptions', 'POST', subscription('expired'));
  const node = (id, type, next) => ({ id, type, next, title: id, body: '', button: 'Дальше', required: true, options: [] });
  const scenario = { title: 'Название сюрприза', theme: 'city-night', start: 'intro', nodes: [node('intro', 'intro', 'when'), { ...node('when', 'datetime', 'accept'), dateMode: 'choose' }, node('accept', 'accept', null)] };
  const draft = (await f.a('/dates/invitations', 'POST', { scenario })).data;
  assert.deepEqual((await f.b('/dates/inbox')).data, []);
  assert.equal(f.deliveries.length, 0);
  const invitation = (await f.a(`/dates/invitations/${draft.id}/publish`, 'POST', { version: draft.version })).data;
  assert.deepEqual((await f.b('/dates/inbox')).data, [{ id: draft.id }]);
  assert.deepEqual((await f.other('/dates/inbox')).data, []);
  assert.deepEqual((await f.a('/dates/inbox')).data, []);
  assert.equal(f.deliveries.length, 1); assert.equal(f.deliveries[0].endpoint, subscription('b').endpoint);
  assert.equal(f.deliveries[0].payload.url, `/?dateInvite=${draft.id}`); assert.ok(!JSON.stringify(f.deliveries[0].payload).includes(scenario.title));
  const body = { versionId: invitation.publishedId, answers: { intro: true, when: { date: '2026-10-20', time: '19:00' }, accept: true } };
  assert.equal((await f.b(`/dates/invitations/${draft.id}/respond`, 'POST', body)).status, 201);
  assert.deepEqual((await f.b('/dates/inbox')).data, []);
  assert.equal(f.deliveries.length, 2); assert.equal(f.deliveries[1].endpoint, subscription('a').endpoint);
  assert.equal((await f.b(`/dates/invitations/${draft.id}/respond`, 'POST', body)).status, 200);
  assert.equal(f.deliveries.length, 2);
  assert.equal(f.app.db.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n, 2);
});

test('service worker handles a background push and keeps notification navigation on the site', async () => {
  const handlers = {}, shown = [], opened = [];
  const self = { location: { origin: 'https://calendar.example' }, addEventListener(name, fn) { handlers[name] = fn; }, registration: { async showNotification(...args) { shown.push(args); } }, clients: { async matchAll() { return []; }, async openWindow(url) { opened.push(url); } } };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, URL });
  let task;
  handlers.push({ data: { json: () => ({ body: 'Новое приглашение', url: '/?dateInvite=abc' }) }, waitUntil(value) { task = value; } }); await task;
  assert.equal(shown[0][0], 'Вдвоём'); assert.equal(shown[0][1].body, 'Новое приглашение');
  for (const url of ['/?dateInvite=abc', 'https://other.example/phishing']) {
    handlers.notificationclick({ notification: { data: { url }, close() {} }, waitUntil(value) { task = value; } }); await task;
  }
  assert.deepEqual(opened, ['https://calendar.example/?dateInvite=abc', 'https://calendar.example/']);
});
