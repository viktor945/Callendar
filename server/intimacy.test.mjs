import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './index.mjs';

const fact = { kind: 'intimacy', title: 'Время для нас', date: '2026-10-11', time: '', status: 'completed', tags: ['Нежность и массаж'] };
const date = { title: 'Ужин', date: '2026-10-11', time: '19:00', category: 'date', location: '', note: '', status: 'planned', continuation: null };

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'vdvoem-intimacy-'));
  const databasePath = join(directory, 'calendar.sqlite');
  let app = await createApp({ databasePath, serveFrontend: false });
  let origin;
  async function listen() { await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${app.server.address().port}`; }
  await listen();
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  function client() {
    let cookie;
    return { get cookie() { return cookie; }, async request(path, method = 'GET', body) {
      const response = await fetch(`${origin}/api${path}`, { method, headers: { cookie: cookie || '', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, data: await response.json() };
    } };
  }
  const a = client(), b = client(), outsider = client();
  const created = await a.request('/pairs', 'POST', { name: 'A', relationshipMode: 'couple', partnerLabel: 'Супруги' });
  await b.request('/join', 'POST', { name: 'B', invite: created.data.invite });
  return { a, b, outsider, get app() { return app; }, get origin() { return origin; }, async restart() { await app.close(); app = await createApp({ databasePath, serveFrontend: false }); await listen(); } };
}

test('relationship settings are shared, versioned and retained after restart', async t => {
  const f = await fixture(t);
  const profile = (await f.b.request('/session')).data.profile;
  assert.equal(profile.relationshipMode, 'couple');
  assert.equal(profile.weeklyGoal, null);
  const result = await f.b.request('/pair/profile', 'PATCH', { ...profile, relationshipMode: 'dating', weeklyGoal: 3 });
  assert.equal(result.status, 200);
  assert.equal(result.data.version, 2);
  assert.deepEqual((await f.a.request('/session')).data.profile, result.data);
  assert.equal((await f.a.request('/pair/profile', 'PATCH', profile)).status, 409);
  assert.equal((await f.a.request('/pair/profile', 'PATCH', { ...result.data, weeklyGoal: -1 })).status, 400);
  assert.equal((await f.outsider.request('/pair/profile', 'PATCH', result.data)).status, 401);
  await f.restart();
  assert.deepEqual((await f.b.request('/session')).data.profile, result.data);
});

test('either partner logs a standalone fact without a time or second confirmation; SSE carries no content', async t => {
  const f = await fixture(t);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${f.origin}/api/stream`, { headers: { cookie: f.a.cookie }, signal: controller.signal });
    const reader = response.body.getReader();
    await reader.read();
    const result = await f.b.request('/events', 'POST', fact);
    assert.equal(result.status, 201);
    assert.equal(result.data.status, 'completed');
    assert.equal(result.data.time, '');
    const message = new TextDecoder().decode((await reader.read()).value);
    assert.match(message, /event: change/);
    assert.ok(!message.includes(fact.title));
    assert.deepEqual((await f.a.request('/session')).data.events, [result.data]);
    const second = await f.a.request('/events', 'POST', { ...fact, title: 'Другая встреча' });
    assert.equal(second.status, 201);
    assert.equal((await f.b.request('/session')).data.events.length, 2);
  } finally { clearTimeout(timeout); controller.abort(); }
});

test('intimacy input rejects invalid kinds, missing plan times and malformed tags', async t => {
  const { a } = await fixture(t);
  for (const patch of [{ kind: 'other' }, { date: '2026-02-30' }, { status: 'planned' }, { time: '24:00' }, { tags: 'bad' }, { tags: Array(13).fill('tag') }, { tags: ['a'.repeat(41)] }, { tags: [null] }, { continuation: { title: 'bad', time: '', wishes: '' } }]) {
    assert.equal((await a.request('/events', 'POST', { ...fact, ...patch })).status, 400, JSON.stringify(patch));
  }
  assert.equal((await a.request('/events', 'POST', { ...fact, tags: ['Массаж', 'Массаж', 'Свой вариант'] })).data.tags.length, 2);
  assert.equal((await a.request('/events', 'POST', { ...date, tags: ['Массаж'] })).status, 400);
});

test('personal ratings stay private, survive restart and are deleted with their event', async t => {
  const f = await fixture(t);
  const event = (await f.a.request('/events', 'POST', fact)).data;
  const path = `/events/${event.id}/private`;
  assert.equal((await f.a.request(path, 'PUT', { note: 'Личное A', rating: 5 })).status, 200);
  assert.deepEqual((await f.b.request(path)).data, { note: '', rating: null });
  await f.b.request(path, 'PUT', { note: 'Личное B', rating: 3 });
  assert.deepEqual((await f.a.request(path)).data, { note: 'Личное A', rating: 5 });
  assert.ok(!JSON.stringify((await f.b.request('/session')).data).includes('rating'));
  assert.equal((await f.a.request(path, 'PUT', { note: 'Неверная правка', rating: 6 })).status, 400);
  assert.equal((await f.a.request(path)).data.note, 'Личное A');
  await f.restart();
  assert.deepEqual((await f.a.request(path)).data, { note: 'Личное A', rating: 5 });
  assert.deepEqual((await f.b.request(path)).data, { note: 'Личное B', rating: 3 });
  const other = (await f.outsider.request('/pairs', 'POST', { name: 'Другой' })).data;
  assert.ok(other.memberId);
  assert.equal((await f.outsider.request(path)).status, 404);
  const plan = (await f.a.request('/events', 'POST', { ...fact, status: 'planned', time: '21:00' })).data;
  assert.equal((await f.a.request(`/events/${plan.id}/private`, 'PUT', { note: '', rating: 5 })).status, 400);
  await f.b.request(`/events/${event.id}`, 'DELETE', { version: event.version });
  assert.equal(f.app.db.prepare('SELECT count(*) AS n FROM private_reflections').get().n, 0);
});

test('linked intimacy has an independent status and remains after deleting its date', async t => {
  const f = await fixture(t);
  const dinner = (await f.a.request('/events', 'POST', date)).data;
  const event = (await f.b.request('/events', 'POST', { ...fact, linkedDateId: dinner.id })).data;
  assert.equal(event.linkedDateId, dinner.id);
  assert.equal((await f.a.request('/events', 'POST', { ...fact, linkedDateId: event.id })).status, 400);
  await f.outsider.request('/pairs', 'POST', { name: 'Другой' });
  assert.equal((await f.outsider.request('/events', 'POST', { ...fact, linkedDateId: dinner.id })).status, 404);
  assert.equal((await f.a.request(`/events/${dinner.id}`, 'PATCH', { ...dinner, kind: 'intimacy' })).status, 409);
  await f.a.request(`/events/${dinner.id}`, 'PATCH', { ...dinner, status: 'completed' });
  assert.equal((await f.b.request('/session')).data.events.find(old => old.id === event.id).version, 1);
  assert.equal((await f.b.request(`/events/${dinner.id}`, 'DELETE', { version: 1 })).status, 409);
  await f.a.request(`/events/${dinner.id}`, 'DELETE', { version: 2 });
  const remaining = (await f.b.request('/session')).data.events;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].status, 'completed');
  assert.equal(remaining[0].linkedDateId, null);
  assert.equal(remaining[0].version, 2);
  assert.equal((await f.b.request(`/events/${event.id}`, 'PATCH', event)).status, 404);
});

test('additive migration preserves legacy sessions, date JSON and personal notes on repeat startup', async t => {
  const f = await fixture(t);
  const event = (await f.a.request('/events', 'POST', date)).data;
  await f.a.request(`/events/${event.id}/private`, 'PUT', { note: 'Старая личная заметка' });
  f.app.db.prepare('UPDATE events SET data = ? WHERE id = ?').run(JSON.stringify(date), event.id);
  f.app.db.exec('DROP TABLE private_reflections; DROP TABLE pair_settings;');
  await f.restart();
  await f.restart();
  const state = (await f.b.request('/session')).data;
  assert.equal(state.members.length, 2);
  assert.equal(state.profile.relationshipMode, 'dating');
  assert.equal(state.profile.weeklyGoal, null);
  assert.deepEqual(state.events[0], { ...date, kind: 'date', tags: [], linkedDateId: null, id: event.id, version: 1 });
  assert.equal((await f.a.request(`/events/${event.id}/private`)).data.note, 'Старая личная заметка');
});
